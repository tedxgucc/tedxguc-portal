-- Acceptance and reallocation are available without an interview-time gate.
-- Team authorization and closed-application protections remain enforced.

create or replace function private.can_accept_application_into(p_app uuid, p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.applications a join public.recruitment_cycles c on c.id = a.cycle_id
    join public.teams t on t.id = p_team and t.season_id = c.season_id
    where a.id = p_app and c.season_id = private.active_season_id()
      and a.stage not in ('accepted', 'withdrawn') and private.can_manage_team(p_team, p_uid)
      and (p_team = any(a.team_choices) or exists(select 1 from public.application_referrals r
        where r.application_id = a.id and r.to_team_id = p_team and r.status = 'pending')))
$$;

create or replace function public.refer_application(p_application_id uuid, p_team_id uuid, p_notes text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_source uuid; v_target public.teams;
begin
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_review_application_id(v_app.id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists(select 1 from public.recruitment_cycles c where c.id = v_app.cycle_id and c.season_id = private.active_season_id()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_app.stage in ('accepted', 'withdrawn') then raise exception 'application_closed'; end if;
  select t.id into v_source from public.teams t where t.id <> p_team_id and private.can_manage_team(t.id)
    and (t.id = any(v_app.team_choices) or exists(select 1 from public.application_referrals r where r.application_id = v_app.id and r.to_team_id = t.id and r.status = 'pending'))
    order by array_position(v_app.team_choices, t.id) nulls last limit 1;
  select * into v_target from public.teams t where t.id = p_team_id and t.season_id = private.active_season_id()
    and exists(select 1 from public.positions p where p.team_id = t.id and p.cycle_id = v_app.cycle_id);
  if v_source is null or v_target.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(coalesce(p_notes, '')) > 2000 then raise exception 'referral_notes_too_long'; end if;
  if exists(select 1 from public.application_referrals where application_id = v_app.id and to_team_id = p_team_id) then raise exception 'already_referred'; end if;
  insert into public.application_referrals(application_id, from_team_id, to_team_id, notes)
    values(v_app.id, v_source, p_team_id, trim(coalesce(p_notes, '')));
  perform private.notify(array(select m.user_id from public.memberships m
    where m.season_id = v_target.season_id and m.status = 'active' and (
      (m.role = 'executive' and m.team_id = p_team_id) or (m.role = 'curator' and m.division_id = v_target.division_id))),
    'application_referred', 'Applicant referred: ' || v_app.applicant_name, null, '/portal/recruitment');
end $$;
