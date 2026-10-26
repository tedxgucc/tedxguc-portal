-- Safe retries for immediate Associate account creation.
create or replace function public.accept_application(p_application_id uuid, p_team_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
  v_team uuid;
  v_season uuid;
  v_invite uuid;
begin
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_review_application_id(v_app.id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Retrying finishes account creation without changing a closed decision.
  if v_app.stage = 'accepted' then
    if not private.can_manage_team(v_app.accepted_team_id)
      or (p_team_id is not null and p_team_id <> v_app.accepted_team_id)
      or not exists(select 1 from public.recruitment_cycles c where c.id = v_app.cycle_id and c.season_id = private.active_season_id()) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    return jsonb_build_object('application_id', v_app.id, 'invite_id', v_app.invite_id,
      'applicant_name', v_app.applicant_name, 'applicant_email', v_app.applicant_email,
      'team', (select name from public.teams where id = v_app.accepted_team_id), 'stage', 'accepted');
  end if;
  if v_app.stage = 'withdrawn' then raise exception 'application_closed'; end if;
  v_team := coalesce(p_team_id, v_app.team_choices[1]);
  if not private.can_accept_application_into(v_app.id, v_team) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select season_id into v_season from public.recruitment_cycles where id = v_app.cycle_id;
  select id into v_invite from public.invites
  where email = v_app.applicant_email and season_id = v_season and accepted_at is null and revoked_at is null and expires_at > now();
  if v_invite is not null and not exists(select 1 from public.invites where id = v_invite and role = 'associate' and team_id = v_team) then
    raise exception 'existing_invite_conflict';
  end if;
  if v_invite is null then
    insert into public.invites (email, season_id, role, team_id, invited_by)
    values (v_app.applicant_email, v_season, 'associate', v_team, auth.uid())
    returning id into v_invite;
  end if;

  update public.applications
     set stage = 'accepted', accepted_team_id = v_team, invite_id = v_invite,
         decided_by = auth.uid(), stage_changed_at = now()
   where id = v_app.id;

  update public.application_referrals set status = case when to_team_id = v_team then 'accepted' else 'closed' end
    where application_id = v_app.id and status = 'pending';

  return jsonb_build_object('application_id', v_app.id, 'invite_id', v_invite,
    'applicant_name', v_app.applicant_name, 'applicant_email', v_app.applicant_email,
    'team', (select name from public.teams where id = v_team), 'stage', 'accepted');
end $$;
