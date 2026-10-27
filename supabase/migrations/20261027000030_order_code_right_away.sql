-- Transfer orders (InstaPay / Telda) get their pickup code the moment the form
-- is submitted. The proof can be sent later; Operations still checks it and
-- the code works at pickup once the payment is confirmed.
create or replace function public.place_order(
  p_package_id uuid, p_name text, p_email text, p_phone text, p_quantity int,
  p_method public.order_method, p_fulfilment text default 'pickup', p_address text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg public.packages;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_token text := private.new_token();
  v_no text;
  v_status public.order_status;
  v_hold timestamptz;
  v_id uuid;
  v_code text := null;
begin
  select * into v_pkg from public.packages where id = p_package_id for update;
  if not found or not private.package_on_sale(v_pkg) then raise exception 'package_not_on_sale'; end if;
  if v_name = '' then raise exception 'invalid_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(trim(coalesce(p_phone, ''))) < 8 then raise exception 'invalid_phone'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_pkg.max_per_order then raise exception 'invalid_quantity'; end if;
  if p_fulfilment = 'delivery' and not v_pkg.allows_delivery then raise exception 'delivery_not_offered'; end if;
  if v_pkg.stock - private.package_reserved(v_pkg.id) < p_quantity then raise exception 'sold_out'; end if;

  if p_method = 'cash' then
    v_status := 'awaiting_cash';
    v_hold := now() + make_interval(days => coalesce((private.setting('cash_hold_days', '3'))::text::int, 3));
  else
    v_status := 'pending_proof';
    v_code := private.new_token(false);
    v_hold := now() + make_interval(hours => coalesce((private.setting('proof_hold_hours', '24'))::text::int, 24));
  end if;
  v_no := private.next_doc_number('PKG', v_pkg.season_id);

  insert into public.orders (order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, unit_price,
                             total_egp, method, fulfilment, delivery_address, status, hold_expires_at,
                             status_token_hash, consent_at, pickup_code, pickup_code_hash)
  values (v_no, v_pkg.id, v_name, v_email, trim(p_phone), p_quantity, v_pkg.price_egp,
          v_pkg.price_egp * p_quantity, p_method, coalesce(p_fulfilment, 'pickup'), nullif(trim(p_address), ''),
          v_status, v_hold, private.hash_token(v_token), now(), v_code, case when v_code is not null then private.hash_token(v_code) end)
  returning id into v_id;

  return jsonb_build_object(
    'order_id', v_id, 'order_no', v_no, 'status', v_status, 'total_egp', v_pkg.price_egp * p_quantity,
    'method', p_method, 'hold_expires_at', v_hold, 'status_token', v_token,
    'buyer_name', v_name, 'buyer_email', v_email, 'package_name', v_pkg.name,
    -- Where to pay (FR-16.3, FR-16.4); the order number goes in the transfer note.
    'payment_link', case p_method
      when 'instapay' then private.setting('instapay_link') #>> '{}'
      when 'telda' then private.setting('telda_link') #>> '{}' end,
    'pickup_info', v_pkg.pickup_info, 'pickup_code', v_code);
end $$;

create or replace function public.get_order_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'package', p.name, 'quantity', o.quantity,
    'total_egp', o.total_egp, 'method', o.method, 'hold_expires_at', o.hold_expires_at,
    'reject_reason', o.reject_reason, 'fulfilment', o.fulfilment, 'pickup_info', p.pickup_info,
    'pickup_code', case when o.status in ('pending_proof', 'pending_approval', 'approved') then o.pickup_code end,
    'payment_link', case when o.status = 'pending_proof' then
        case o.method when 'instapay' then private.setting('instapay_link') #>> '{}'
                      when 'telda' then private.setting('telda_link') #>> '{}' end end)
  from public.orders o join public.packages p on p.id = o.package_id
  where o.status_token_hash = private.hash_token(p_status_token)
$$;

create or replace function private.confirm_order(p_order public.orders) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := coalesce(p_order.pickup_code, private.new_token(false));
  v_txn uuid;
  v_pkg public.packages;
begin
  select * into v_pkg from public.packages where id = p_order.package_id;
  insert into public.transactions (season_id, kind, method, amount_gross, vat_applies, item, description, order_id, created_by)
  values (v_pkg.season_id, 'package_sale', p_order.method::text::public.pay_method, p_order.total_egp, false,
          v_pkg.name, 'Order ' || p_order.order_no, p_order.id, auth.uid())
  returning id into v_txn;
  update public.orders
     set status = 'approved', approved_by = auth.uid(), approved_at = now(), hold_expires_at = null,
         pickup_code = v_code, pickup_code_hash = private.hash_token(v_code), transaction_id = v_txn
   where id = p_order.id;
  return jsonb_build_object(
    'order_id', p_order.id, 'order_no', p_order.order_no, 'status', 'approved', 'pickup_code', v_code,
    'buyer_name', p_order.buyer_name, 'buyer_email', p_order.buyer_email, 'package_name', v_pkg.name,
    'quantity', p_order.quantity, 'total_egp', p_order.total_egp, 'pickup_info', v_pkg.pickup_info);
end $$;
