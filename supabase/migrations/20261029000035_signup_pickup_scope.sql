-- Per-signup pickup assignments, with explicit expiry and active membership checks.
create table public.signup_pickup_scanners (
  package_id uuid not null references public.packages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  assigned_by uuid default auth.uid() references public.users(id),
  primary key(package_id, user_id)
);
alter table public.signup_pickup_scanners enable row level security;
create function private.leads_pickups(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.membership_of(p_uid) m where m.role in ('chairman','curator')
  or (m.role = 'executive' and m.team_kind = 'logistics_planning'))
$$;
create policy "Pickup leaders manage signup scanners" on public.signup_pickup_scanners for all to authenticated
 using (private.leads_pickups() and exists(select 1 from public.packages p where p.id = package_id and p.season_id = private.active_season_id()))
 with check (private.leads_pickups() and expires_at > now()
  and exists(select 1 from public.packages p where p.id = package_id and p.season_id = private.active_season_id())
  and exists(select 1 from private.membership_of(user_id)));
create policy "Scanners see own assignments" on public.signup_pickup_scanners for select to authenticated
 using (user_id = auth.uid() and private.is_member());
revoke all on public.signup_pickup_scanners from anon;
grant select, insert, update, delete on public.signup_pickup_scanners to authenticated;
-- Global assignments no longer grant pickup access.
revoke insert, update, delete on public.pickup_scanners from authenticated;
create function private.can_scan_signup(p_package uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.membership_of(p_uid)) and exists(
  select 1 from public.packages p where p.id = p_package and p.season_id = private.active_season_id()
   and (private.leads_pickups(p_uid) or (p.is_active and (p.closes_at is null or p.closes_at > now())
    and exists(select 1 from public.signup_pickup_scanners s where s.package_id = p.id
      and s.user_id = p_uid and s.expires_at > now()))))
$$;
create or replace function private.can_scan_pickups(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.leads_pickups(p_uid) or exists(select 1 from public.signup_pickup_scanners s
  where s.user_id = p_uid and private.can_scan_signup(s.package_id, p_uid))
$$;

create or replace function public.pickup_order(p_pickup_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_pkg text;
begin
  if not private.can_scan_pickups() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_order from public.orders where pickup_code_hash = private.hash_token(trim(coalesce(p_pickup_code, ''))) or lower(order_no) = lower(trim(coalesce(p_pickup_code, ''))) for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if not private.can_scan_signup(v_order.package_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
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
