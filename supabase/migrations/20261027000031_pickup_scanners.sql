-- Pickup scanners: like event door staff, sign-up managers can let any
-- member scan pickup QRs (Operations and approvers still can, as before).
create table public.pickup_scanners (
  season_id   uuid not null references public.seasons (id) default private.active_season_id(),
  user_id     uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);
alter table public.pickup_scanners enable row level security;
create policy "Members read pickup scanners" on public.pickup_scanners for select to authenticated
  using ((select private.is_member()));
create policy "Sign-up managers assign pickup scanners" on public.pickup_scanners for all to authenticated
  using ((select private.can_manage_signups())) with check ((select private.can_manage_signups()));
revoke all on public.pickup_scanners from anon;

create function private.can_scan_pickups(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_approve_orders(p_uid)
      or private.in_division_kind('operations', p_uid)
      or private.can_manage_signups(p_uid)
      or exists (select 1 from public.pickup_scanners s
                 where s.user_id = p_uid and s.season_id = private.active_season_id())
$$;

-- For the portal menu.
create function public.can_scan_pickups() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.can_scan_pickups(), false)
$$;
grant execute on function public.can_scan_pickups() to authenticated;

create or replace function public.pickup_order(p_pickup_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_pkg text;
begin
  if not private.can_scan_pickups() then
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
