-- Executives can reject applicants they are authorized to accept. Other stage
-- changes stay with Curators and the Chairman. Reallocation can target any
-- other team in the active season, without requiring an open position.

create or replace function public.set_application_stage(p_ids uuid[], p_stage public.application_stage) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app record;
  v_out jsonb := '[]';
  v_released boolean;
begin
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  if p_stage not in ('applied', 'screened', 'interview', 'rejected') then
    raise exception 'use_accept_application';
  end if;
  for v_app in
    select a.*, c.rejections_released_at, c.name as cycle_name
    from public.applications a join public.recruitment_cycles c on c.id = a.cycle_id
    where a.id = any (p_ids)
    for update of a
  loop
    if not (private.can_decide_application(v_app.team_choices)
      or (p_stage = 'rejected' and exists(select 1 from public.teams t where private.can_accept_application_into(v_app.id, t.id)))) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if v_app.stage in ('accepted', 'withdrawn') then
      raise exception 'application_closed';
    end if;
    v_released := v_app.rejections_released_at is not null;
    update public.applications
       set stage = p_stage, stage_changed_at = now(), decided_by = auth.uid(),
           rejection_notified_at = case when p_stage = 'rejected' and v_released then now() end
     where id = v_app.id;
    if p_stage <> 'interview' then
      update public.interview_slots set application_id = null, booked_at = null where application_id = v_app.id;
    end if;
    if p_stage <> 'rejected' or v_released then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'application_id', v_app.id, 'applicant_name', v_app.applicant_name,
        'applicant_email', v_app.applicant_email, 'cycle_name', v_app.cycle_name, 'stage', p_stage));
    end if;
  end loop;
  return v_out;
end $$;

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
  select * into v_target from public.teams t where t.id = p_team_id and t.season_id = private.active_season_id();
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
