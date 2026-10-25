-- Round of changes from the club (2026-10-25):
-- 1. Packages become member-only "sign-ups" (packages, trips, anything that
--    needs registration) with a form builder. Managed by the Chairman, the
--    OD and Operations Curators, and the L&P and AE Executives.
-- 2. Money requests: only L&P Executives ask; the Operations Curator decides;
--    only they and the Chairman see them.
-- 3. Door check-in: Chairman, Operations Curator, L&P Executives, and L&P
--    Associates on event day only, plus anyone added as door staff.
-- 4. Photos on announcements and events; event managers manage speakers.

-- ---------------------------------------------------------------------
-- 1. Sign-ups
-- ---------------------------------------------------------------------
alter table public.packages
  add column kind text not null default 'package' check (kind in ('package', 'trip', 'other')),
  add column questions jsonb not null default '[]';
alter table public.packages drop constraint packages_price_egp_check;
alter table public.packages add constraint packages_price_egp_check check (price_egp >= 0);

alter table public.orders
  add column user_id uuid references public.users (id),
  add column answers jsonb not null default '{}';
create index orders_user_idx on public.orders (user_id, package_id);
grant select (user_id, answers) on public.orders to authenticated;

create function private.can_manage_signups(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman'
       or (m.role = 'curator' and m.division_kind in ('operations', 'org_development'))
       or (m.role = 'executive' and m.team_kind in ('logistics_planning', 'associates_experience')))
$$;

create or replace function private.can_approve_orders(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_signups(p_uid)
      or (private.in_division_kind('operations', p_uid)
          and exists (select 1 from public.package_approvers a
                      where a.user_id = p_uid and a.season_id = private.active_season_id()))
$$;

drop policy "Anyone reads active packages" on public.packages;
drop policy "Operations manages packages" on public.packages;
revoke select on public.packages from anon;
create policy "Members read open sign-ups" on public.packages for select to authenticated
  using ((is_active and (select private.is_member())) or (select private.can_manage_signups()));
create policy "Sign-up managers manage sign-ups" on public.packages for all to authenticated
  using ((select private.can_manage_signups())) with check ((select private.can_manage_signups()));

create policy "Members read own sign-ups" on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.package_stock(p_package_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(p.stock - private.package_reserved(p.id), 0)
  from public.packages p
  where p.id = p_package_id and ((p.is_active and private.is_member()) or private.can_manage_signups())
$$;
revoke execute on function public.package_stock(uuid) from anon;

-- A member signs up. Name and email come from their account; answers are
-- checked against the sign-up's required questions. Free sign-ups are
-- confirmed at once; paid ones follow the usual payment steps.
create function public.member_sign_up(
  p_package_id uuid, p_phone text, p_quantity int default 1, p_method public.order_method default 'cash',
  p_fulfilment text default 'pickup', p_address text default null, p_answers jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_user public.users;
  v_pkg public.packages;
  v_q jsonb;
  v_a jsonb;
  v_res jsonb;
  v_token text;
  v_code text;
  v_no text;
  v_id uuid;
begin
  if not private.is_member(v_uid) then raise exception 'members_only' using errcode = '42501'; end if;
  select * into v_user from public.users where id = v_uid;
  select * into v_pkg from public.packages where id = p_package_id;
  if not found or not private.package_on_sale(v_pkg) then raise exception 'package_not_on_sale'; end if;
  if exists (select 1 from public.orders where user_id = v_uid and package_id = p_package_id
             and status not in ('cancelled', 'expired', 'rejected', 'refunded')) then
    raise exception 'already_signed_up';
  end if;

  for v_q in select * from jsonb_array_elements(v_pkg.questions) loop
    if coalesce((v_q ->> 'required')::boolean, false) then
      v_a := coalesce(p_answers, '{}') -> (v_q ->> 'id');
      if v_a is null or v_a = 'null'::jsonb
         or (jsonb_typeof(v_a) = 'string' and trim(v_a #>> '{}') = '')
         or (jsonb_typeof(v_a) = 'array' and jsonb_array_length(v_a) = 0) then
        raise exception 'answer_required' using detail = v_q ->> 'label';
      end if;
    end if;
  end loop;

  if v_pkg.price_egp = 0 then
    if p_quantity is null or p_quantity < 1 or p_quantity > v_pkg.max_per_order then raise exception 'invalid_quantity'; end if;
    if v_pkg.stock - private.package_reserved(v_pkg.id) < p_quantity then raise exception 'sold_out'; end if;
    v_token := private.new_token();
    v_code := private.new_token(false);
    v_no := private.next_doc_number('PKG', v_pkg.season_id);
    insert into public.orders (order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, unit_price, total_egp,
                               method, fulfilment, status, approved_at, pickup_code, pickup_code_hash,
                               status_token_hash, consent_at, user_id, answers)
    values (v_no, v_pkg.id, v_user.name, lower(v_user.email), trim(coalesce(p_phone, '')), p_quantity, 0, 0,
            'cash', 'pickup', 'approved', now(), v_code, private.hash_token(v_code),
            private.hash_token(v_token), now(), v_uid, coalesce(p_answers, '{}'))
    returning id into v_id;
    return jsonb_build_object('order_id', v_id, 'order_no', v_no, 'status', 'approved', 'total_egp', 0,
      'status_token', v_token, 'package_name', v_pkg.name);
  end if;

  v_res := public.place_order(p_package_id, v_user.name, v_user.email, p_phone, p_quantity, p_method, p_fulfilment, p_address);
  update public.orders set user_id = v_uid, answers = coalesce(p_answers, '{}') where id = (v_res ->> 'order_id')::uuid;
  return v_res;
end $$;
revoke execute on function public.member_sign_up(uuid, text, int, public.order_method, text, text, jsonb) from public, anon;
grant execute on function public.member_sign_up(uuid, text, int, public.order_method, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Money requests: L&P Executives ask, the Operations Curator decides.
-- ---------------------------------------------------------------------
create or replace function private.can_see_expense_request(
  p_team uuid, p_requested_by uuid, p_status public.expense_status, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_requested_by = p_uid
      or private.leads_kind('operations', p_uid)
      or private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid)
$$;

drop policy "Members request for their own team" on public.expense_requests;
create policy "L&P Executives request money" on public.expense_requests for insert to authenticated
  with check (requested_by = (select auth.uid())
              and status = 'submitted'
              and season_id = (select private.active_season_id())
              and (select private.in_team_kind('logistics_planning', array['executive']::public.member_role[]))
              and private.can_see_team(team_id));

create or replace function private.can_decide_submitted_expense(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
$$;

-- decide_expense_request: the Operations Curator (or Chairman) decides
-- first; amounts above the limit still go to the Chairman.
create or replace function public.decide_expense_request(p_id uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.expense_requests;
  v_limit numeric := coalesce((private.setting('expense_chairman_limit_egp', '5000'))::text::numeric, 5000);
  v_chair boolean := private.is_chairman();
  v_new public.expense_status;
begin
  select * into v_req from public.expense_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if v_req.status = 'submitted' then
    if not private.can_decide_submitted_expense() then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif v_req.status = 'awaiting_chairman' then
    if not v_chair then raise exception 'not_allowed' using errcode = '42501'; end if;
  else
    raise exception 'already_decided';
  end if;

  if not p_approve then
    v_new := 'rejected';
  elsif v_req.amount_egp > v_limit and not v_chair then
    v_new := 'awaiting_chairman';
  else
    v_new := 'approved';
  end if;

  update public.expense_requests
     set status = v_new,
         reject_reason = case when v_new = 'rejected' then p_reason end,
         curator_decided_by = case when v_req.status = 'submitted' then auth.uid() else curator_decided_by end,
         curator_decided_at = case when v_req.status = 'submitted' then now() else curator_decided_at end,
         chairman_decided_by = case when v_chair then auth.uid() else chairman_decided_by end,
         chairman_decided_at = case when v_chair then now() else chairman_decided_at end
   where id = p_id;

  if v_new = 'awaiting_chairman' then
    perform private.notify(
      array(select m.user_id from public.memberships m
            where m.season_id = private.active_season_id() and m.role = 'chairman' and m.status = 'active'),
      'expense_needs_chairman', 'Expense over the limit: ' || v_req.item, null, '/portal/expenses/' || p_id);
  elsif v_new = 'approved' then
    perform private.notify(
      array[v_req.requested_by] || array(
        select m.user_id from public.memberships m join public.teams t on t.id = m.team_id
        where m.status = 'active' and m.role = 'executive' and t.kind = 'logistics_planning'
          and m.season_id = private.active_season_id()),
      'expense_approved', 'Approved: ' || v_req.item, null, '/portal/expenses/' || p_id);
  else
    perform private.notify(array[v_req.requested_by], 'expense_rejected', 'Rejected: ' || v_req.item,
      p_reason, '/portal/expenses/' || p_id);
  end if;

  return jsonb_build_object('status', v_new, 'budget', public.division_budget_status(private.team_division(v_req.team_id)));
end $$;
revoke execute on function public.decide_expense_request(uuid, boolean, text) from public, anon;

-- ---------------------------------------------------------------------
-- 3. Door check-in
-- ---------------------------------------------------------------------
create or replace function private.can_check_in(p_event uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
      or private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid)
      -- L&P Associates only on the day of the event (Cairo time).
      or (private.in_team_kind('logistics_planning', array['associate']::public.member_role[], p_uid)
          and exists (select 1 from public.events e where e.id = p_event
                      and (e.starts_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date))
      or (private.is_member(p_uid) and exists (
            select 1 from public.event_staff s
            where s.event_id = p_event and s.user_id = p_uid and s.duty = 'checkin'))
$$;

-- ---------------------------------------------------------------------
-- 4. Photos and speakers
-- ---------------------------------------------------------------------
alter table public.announcements add column image_url text;
alter table public.events add column cover_url text;

create or replace function private.can_manage_speakers(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('talks', p_uid)
      or private.can_manage_events(p_uid)
      or exists (select 1 from private.membership_of(p_uid) m
                 where m.division_kind = 'talks' and m.role = 'executive')
$$;

-- A member reopens their own sign-up from "My sign-ups": issue a fresh
-- private link (the old one stops working). Only for the member's own order.
create function public.member_order_link(p_order_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := private.new_token();
begin
  update public.orders set status_token_hash = private.hash_token(v_token)
   where id = p_order_id and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  return v_token;
end $$;
revoke execute on function public.member_order_link(uuid) from public, anon;
grant execute on function public.member_order_link(uuid) to authenticated;

-- Event managers announce internal events to the whole club.
create or replace function private.can_post_announcement(
  p_type public.audience_type, p_division uuid, p_team uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman'
       or (m.role = 'curator' and (
             (p_type = 'division' and p_division = m.division_id)
          or (p_type = 'team' and private.team_division(p_team) = m.division_id)))
       or (m.role = 'executive' and p_type = 'team' and p_team = m.team_id)
  ) or (p_type = 'all' and private.can_manage_events(p_uid))
$$;
