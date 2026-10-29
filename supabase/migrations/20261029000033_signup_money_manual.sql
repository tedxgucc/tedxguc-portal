-- Signup payment status and pickup codes are independent of bank accounting.
-- Existing accounting history is preserved; executives record future entries manually.
create or replace function private.confirm_order(p_order public.orders) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := coalesce(p_order.pickup_code, private.new_token(false));
  v_pkg public.packages;
begin
  select * into v_pkg from public.packages where id = p_order.package_id;
  update public.orders
     set status = 'approved', approved_by = auth.uid(), approved_at = now(), hold_expires_at = null,
         pickup_code = v_code, pickup_code_hash = private.hash_token(v_code)
   where id = p_order.id;
  return jsonb_build_object(
    'order_id', p_order.id, 'order_no', p_order.order_no, 'status', 'approved', 'pickup_code', v_code,
    'buyer_name', p_order.buyer_name, 'buyer_email', p_order.buyer_email, 'package_name', v_pkg.name,
    'quantity', p_order.quantity, 'total_egp', p_order.total_egp, 'pickup_info', v_pkg.pickup_info);
end $$;

create or replace function public.refund_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  if not private.leads_kind('operations') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status not in ('approved', 'delivered') then raise exception 'order_not_paid'; end if;
  update public.orders set status = 'refunded', reject_reason = trim(p_reason)
   where id = p_order_id;
end $$;
