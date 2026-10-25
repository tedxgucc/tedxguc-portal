-- =====================================================================
-- 0011 · Package sales: packages, orders by InstaPay / Telda / cash,
--        payment approval, pickup scan, refunds.
-- Requirements: FR-16.1–FR-16.11
--
-- Order life:
--   InstaPay / Telda: pending_proof (24 h hold) → pending_approval → approved | rejected
--   Cash:             awaiting_cash (N-day hold) → approved (paid at the booth)
--   Unpaid holds expire and release stock. approved → delivered at pickup.
--   approved / delivered → refunded (Operations Curator or Chairman).
-- Approvers: the Operations Curator, the Chairman, and Operations members
-- the Operations Curator assigns.
-- =====================================================================

create type public.order_method as enum ('instapay', 'telda', 'cash');
create type public.order_status as enum (
  'pending_proof', 'pending_approval', 'awaiting_cash', 'approved', 'delivered',
  'rejected', 'expired', 'cancelled', 'refunded');

create table public.packages (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) default private.active_season_id(),
  name          text not null,
  photo_url     text,
  contents      jsonb not null default '[]',
  description   text,
  price_egp     numeric(10, 2) not null check (price_egp > 0),
  stock         int not null check (stock >= 0),
  max_per_order int not null default 5 check (max_per_order > 0),
  opens_at      timestamptz,
  closes_at     timestamptz,
  is_active     boolean not null default false,
  pickup_info   text,
  allows_delivery boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger packages_touch before update on public.packages
  for each row execute function private.touch_updated_at();
create trigger packages_audit after insert or update or delete on public.packages
  for each row execute function private.audit();

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_no          text not null unique,
  package_id        uuid not null references public.packages (id),
  buyer_name        text not null,
  buyer_email       text not null check (buyer_email = lower(buyer_email)),
  buyer_phone       text not null,
  quantity          int not null check (quantity > 0),
  unit_price        numeric(10, 2) not null,
  total_egp         numeric(12, 2) not null,
  method            public.order_method not null,
  fulfilment        text not null default 'pickup' check (fulfilment in ('pickup', 'delivery')),
  delivery_address  text,
  proof_path        text,
  payment_reference text,
  status            public.order_status not null,
  hold_expires_at   timestamptz,
  reject_reason     text,
  approved_by       uuid references public.users (id),
  approved_at       timestamptz,
  delivered_by      uuid references public.users (id),
  delivered_at      timestamptz,
  pickup_code       text unique,
  pickup_code_hash  text unique,
  status_token_hash text not null unique,
  consent_at        timestamptz not null,
  transaction_id    uuid references public.transactions (id),
  refund_transaction_id uuid references public.transactions (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (fulfilment = 'pickup' or length(trim(coalesce(delivery_address, ''))) > 0)
);
create index orders_package_idx on public.orders (package_id, status);
create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();
create trigger orders_audit after insert or update on public.orders
  for each row execute function private.audit();

alter table public.transactions
  add constraint transactions_order_fk foreign key (order_id) references public.orders (id);

-- Operations members the Operations Curator lets approve payments (FR-16.7).
create table public.package_approvers (
  season_id   uuid not null references public.seasons (id) default private.active_season_id(),
  user_id     uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);

create function private.can_approve_orders(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
      or (private.in_division_kind('operations', p_uid)
          and exists (select 1 from public.package_approvers a
                      where a.user_id = p_uid and a.season_id = private.active_season_id()))
$$;

-- Orders that hold stock.
create function private.package_reserved(p_package uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(quantity), 0)::int from public.orders
  where package_id = p_package
    and status in ('pending_proof', 'pending_approval', 'awaiting_cash', 'approved', 'delivered')
$$;

create function private.package_on_sale(p public.packages) returns boolean
language sql stable set search_path = '' as $$
  select p.is_active
     and (p.opens_at is null or now() >= p.opens_at)
     and (p.closes_at is null or now() < p.closes_at)
$$;

-- Approvers must be in the Operations division.
create function private.package_approvers_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_division_kind('operations', new.user_id) then
    raise exception 'approver_must_be_in_operations';
  end if;
  return new;
end $$;
create trigger package_approvers_check before insert on public.package_approvers
  for each row execute function private.package_approvers_check();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.packages enable row level security;
alter table public.orders enable row level security;
alter table public.package_approvers enable row level security;

create policy "Anyone reads active packages" on public.packages for select to anon, authenticated
  using (is_active or (select private.leads_kind('operations')));
create policy "Operations manages packages" on public.packages for all to authenticated
  using ((select private.leads_kind('operations'))) with check ((select private.leads_kind('operations')));

create policy "Approvers read orders" on public.orders for select to authenticated
  using ((select private.can_approve_orders()));
revoke all on public.orders from anon, authenticated;
grant select (id, order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, unit_price, total_egp,
              method, fulfilment, delivery_address, proof_path, payment_reference, status, hold_expires_at,
              reject_reason, approved_by, approved_at, delivered_by, delivered_at, consent_at,
              transaction_id, refund_transaction_id, created_at, updated_at) on public.orders to authenticated;

create policy "Operations reads approvers" on public.package_approvers for select to authenticated
  using ((select private.in_division_kind('operations')) or (select private.leads_kind('operations')));
create policy "Operations Curator assigns approvers" on public.package_approvers for all to authenticated
  using ((select private.leads_kind('operations'))) with check ((select private.leads_kind('operations')));
revoke all on public.package_approvers from anon;

-- Stock left, for the public page (FR-16.1).
create function public.package_stock(p_package_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(p.stock - private.package_reserved(p.id), 0)
  from public.packages p where p.id = p_package_id and (p.is_active or private.leads_kind('operations'))
$$;

-- ---------------------------------------------------------------------
-- Buyer actions (through public-forms, service role)
-- ---------------------------------------------------------------------
create function public.place_order(
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
    v_hold := now() + make_interval(hours => coalesce((private.setting('proof_hold_hours', '24'))::text::int, 24));
  end if;
  v_no := private.next_doc_number('PKG', v_pkg.season_id);

  insert into public.orders (order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, unit_price,
                             total_egp, method, fulfilment, delivery_address, status, hold_expires_at,
                             status_token_hash, consent_at)
  values (v_no, v_pkg.id, v_name, v_email, trim(p_phone), p_quantity, v_pkg.price_egp,
          v_pkg.price_egp * p_quantity, p_method, coalesce(p_fulfilment, 'pickup'), nullif(trim(p_address), ''),
          v_status, v_hold, private.hash_token(v_token), now())
  returning id into v_id;

  return jsonb_build_object(
    'order_id', v_id, 'order_no', v_no, 'status', v_status, 'total_egp', v_pkg.price_egp * p_quantity,
    'method', p_method, 'hold_expires_at', v_hold, 'status_token', v_token,
    'buyer_name', v_name, 'buyer_email', v_email, 'package_name', v_pkg.name,
    -- Where to pay (FR-16.3, FR-16.4); the order number goes in the transfer note.
    'payment_link', case p_method
      when 'instapay' then private.setting('instapay_link') #>> '{}'
      when 'telda' then private.setting('telda_link') #>> '{}' end,
    'pickup_info', v_pkg.pickup_info);
end $$;

-- After paying: screenshot path and/or transfer reference (FR-16.5).
create function public.submit_payment_proof(p_status_token text, p_proof_path text, p_reference text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where status_token_hash = private.hash_token(p_status_token) for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.method = 'cash' or v_order.status not in ('pending_proof', 'pending_approval') then
    raise exception 'order_not_awaiting_proof';
  end if;
  if p_proof_path is null and length(trim(coalesce(p_reference, ''))) = 0 then
    raise exception 'proof_required';
  end if;
  if p_proof_path is not null and p_proof_path !~ '^proofs/[0-9a-f-]{36}\.(png|jpe?g|webp|pdf)$' then
    raise exception 'invalid_proof';
  end if;
  update public.orders
     set proof_path = coalesce(p_proof_path, proof_path),
         payment_reference = coalesce(nullif(trim(p_reference), ''), payment_reference),
         status = 'pending_approval', hold_expires_at = null
   where id = v_order.id;

  perform private.notify(
    array(select a.user_id from public.package_approvers a where a.season_id = private.active_season_id()
          union
          select m.user_id from public.memberships m join public.divisions d on d.id = m.division_id
          where m.role = 'curator' and m.status = 'active' and d.kind = 'operations'
            and m.season_id = private.active_season_id()),
    'order_to_approve', 'Payment to check: ' || v_order.order_no, null, '/portal/orders/' || v_order.id);
  return jsonb_build_object('order_no', v_order.order_no, 'status', 'pending_approval');
end $$;

-- Buyer's private status page.
create function public.get_order_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'package', p.name, 'quantity', o.quantity,
    'total_egp', o.total_egp, 'method', o.method, 'hold_expires_at', o.hold_expires_at,
    'reject_reason', o.reject_reason, 'fulfilment', o.fulfilment, 'pickup_info', p.pickup_info,
    'pickup_code', case when o.status = 'approved' then o.pickup_code end,
    'payment_link', case when o.status = 'pending_proof' then
        case o.method when 'instapay' then private.setting('instapay_link') #>> '{}'
                      when 'telda' then private.setting('telda_link') #>> '{}' end end)
  from public.orders o join public.packages p on p.id = o.package_id
  where o.status_token_hash = private.hash_token(p_status_token)
$$;

create function public.cancel_order(p_status_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'cancelled', hold_expires_at = null
   where status_token_hash = private.hash_token(p_status_token)
     and status in ('pending_proof', 'awaiting_cash');
  if not found then raise exception 'cannot_cancel'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Operations actions
-- ---------------------------------------------------------------------

-- Confirm a paid order: pickup QR code + cashbook entry (FR-16.7, FR-16.8).
create function private.confirm_order(p_order public.orders) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := private.new_token(false);
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

create function public.decide_order(p_order_id uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  if not private.can_approve_orders() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status <> 'pending_approval' then raise exception 'order_not_pending'; end if;
  if p_approve then
    return private.confirm_order(v_order);
  end if;
  update public.orders set status = 'rejected', reject_reason = p_reason, approved_by = auth.uid(), approved_at = now()
   where id = p_order_id;
  return jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'status', 'rejected',
    'reject_reason', p_reason, 'buyer_name', v_order.buyer_name, 'buyer_email', v_order.buyer_email);
end $$;

-- Cash paid at the booth (FR-16.6).
create function public.mark_cash_paid(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  if not private.can_approve_orders() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status <> 'awaiting_cash' then raise exception 'order_not_awaiting_cash'; end if;
  return private.confirm_order(v_order);
end $$;

-- Pickup scan (FR-16.9): ok · already_delivered · not_paid · not_found
create function public.pickup_order(p_pickup_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_pkg text;
begin
  if not (private.can_approve_orders() or private.in_division_kind('operations')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_order from public.orders where pickup_code_hash = private.hash_token(trim(coalesce(p_pickup_code, ''))) for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  select name into v_pkg from public.packages where id = v_order.package_id;
  if v_order.status = 'delivered' then
    return jsonb_build_object('result', 'already_delivered', 'order_no', v_order.order_no, 'delivered_at', v_order.delivered_at);
  elsif v_order.status <> 'approved' then
    return jsonb_build_object('result', 'not_paid', 'order_no', v_order.order_no, 'status', v_order.status);
  end if;
  update public.orders set status = 'delivered', delivered_by = auth.uid(), delivered_at = now() where id = v_order.id;
  return jsonb_build_object('result', 'ok', 'order_no', v_order.order_no, 'buyer_name', v_order.buyer_name,
                            'package', v_pkg, 'quantity', v_order.quantity);
end $$;

-- Refund a confirmed order (FR-16.11): reversing cashbook entry.
create function public.refund_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_txn uuid;
begin
  if not private.leads_kind('operations') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status not in ('approved', 'delivered') then raise exception 'order_not_paid'; end if;
  insert into public.transactions (season_id, kind, method, amount_gross, vat_applies, description, order_id, created_by)
  select p.season_id, 'refund', v_order.method::text::public.pay_method, v_order.total_egp, false,
         'Refund ' || v_order.order_no || ': ' || trim(p_reason), v_order.id, auth.uid()
  from public.packages p where p.id = v_order.package_id
  returning id into v_txn;
  update public.orders set status = 'refunded', refund_transaction_id = v_txn, reject_reason = trim(p_reason)
   where id = p_order_id;
end $$;

-- Sales by method (FR-16.10).
create function public.package_sales(p_package_id uuid default null)
returns table (package_id uuid, package text, method public.order_method, orders bigint, units bigint, total_egp numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_approve_orders() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select p.id, p.name, o.method, count(*), sum(o.quantity)::bigint, sum(o.total_egp)
    from public.orders o join public.packages p on p.id = o.package_id
    where o.status in ('approved', 'delivered') and (p_package_id is null or p.id = p_package_id)
      and p.season_id = private.active_season_id()
    group by p.id, p.name, o.method
    order by p.name, o.method;
end $$;

-- Release stock from unpaid holds (FR-16.6). Runs every 10 minutes.
create function public.expire_orders() returns int
language sql security definer set search_path = '' as $$
  with gone as (
    update public.orders set status = 'expired'
     where status in ('pending_proof', 'awaiting_cash') and hold_expires_at < now()
    returning 1)
  select count(*)::int from gone
$$;

revoke execute on function public.place_order(uuid, text, text, text, int, public.order_method, text, text) from public, anon, authenticated;
revoke execute on function public.submit_payment_proof(text, text, text) from public, anon, authenticated;
revoke execute on function public.cancel_order(text) from public, anon, authenticated;
revoke execute on function public.expire_orders() from public, anon, authenticated;
grant execute on function public.place_order(uuid, text, text, text, int, public.order_method, text, text) to service_role;
grant execute on function public.submit_payment_proof(text, text, text) to service_role;
grant execute on function public.cancel_order(text) to service_role;
grant execute on function public.expire_orders() to service_role;
revoke execute on function public.decide_order(uuid, boolean, text) from public, anon;
revoke execute on function public.mark_cash_paid(uuid) from public, anon;
revoke execute on function public.pickup_order(text) from public, anon;
revoke execute on function public.refund_order(uuid, text) from public, anon;
revoke execute on function public.package_sales(uuid) from public, anon;

-- Payment screenshots: private bucket, uploaded through a signed link.
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;
create policy "Approvers read payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and private.can_approve_orders());

-- Default settings for package sales; links filled in by Operations.
insert into public.settings (season_id, key, value)
select id, v.key, v.value::jsonb from public.seasons s,
  (values ('cash_hold_days', '3'), ('proof_hold_hours', '24'), ('vat_rate', '0.14')) as v (key, value)
where s.is_active
on conflict do nothing;

-- Scheduled jobs (skipped where pg_cron isn't installed).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-orders', '*/10 * * * *', 'select public.expire_orders()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Upload limits per bucket (size in bytes, allowed file types).
-- ---------------------------------------------------------------------
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf']
 where id = 'applications';
update storage.buckets set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id in ('payment-proofs', 'excuses');
update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'finance';
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'avatars';
update storage.buckets set file_size_limit = 52428800 where id in ('files', 'task-files', 'site');
