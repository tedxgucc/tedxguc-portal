-- Reallocation preserves the applicant's original team preferences.
create table public.application_referrals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_team_id uuid not null references public.teams(id),
  to_team_id uuid not null references public.teams(id),
  referred_by uuid not null references public.users(id) default auth.uid(),
  notes text not null default '',
  status text not null default 'pending' check(status in ('pending', 'accepted', 'closed')),
  created_at timestamptz not null default now(),
  unique(application_id, to_team_id),
  check(from_team_id <> to_team_id)
);
alter table public.application_referrals enable row level security;
revoke all on public.application_referrals from anon, authenticated;
grant select on public.application_referrals to authenticated;
create policy "Source and receiving teams read referrals" on public.application_referrals for select to authenticated
  using (private.can_manage_team(from_team_id) or private.can_manage_team(to_team_id));
create trigger application_referrals_audit after insert or update or delete on public.application_referrals
  for each row execute function private.audit();

create or replace function private.can_review_application_id(p_app uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.applications a where a.id = p_app and (
    private.can_review_application(a.team_choices, p_uid)
    or exists(select 1 from public.application_referrals r where r.application_id = a.id and private.can_manage_team(r.to_team_id, p_uid))))
$$;
alter policy "Reviewers read applications" on public.applications
  using (private.can_review_application_id(id));

create function private.application_interview_completed(p_app uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.interview_slots where application_id = p_app and ends_at <= now())
$$;

create function private.can_accept_application_into(p_app uuid, p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.applications a join public.recruitment_cycles c on c.id = a.cycle_id
    join public.teams t on t.id = p_team and t.season_id = c.season_id
    where a.id = p_app and c.season_id = private.active_season_id()
      and a.stage not in ('accepted', 'withdrawn') and private.can_manage_team(p_team, p_uid)
      and (p_team = any(a.team_choices) or exists(select 1 from public.application_referrals r
        where r.application_id = a.id and r.to_team_id = p_team and r.status = 'pending'))
      and (private.my_role(p_uid) in ('chairman', 'curator')
        or (private.my_role(p_uid) = 'executive' and a.stage = 'interview' and private.application_interview_completed(a.id))))
$$;

create function public.application_decision_context(p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_review_application_id(p_application_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'interview_completed', private.application_interview_completed(p_application_id),
    'acceptable_team_ids', coalesce((select jsonb_agg(t.id) from public.teams t where private.can_accept_application_into(p_application_id, t.id)), '[]'),
    'referrals', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.application_referrals r
      where r.application_id = p_application_id and (private.can_manage_team(r.from_team_id) or private.can_manage_team(r.to_team_id))), '[]')
  );
end $$;

create function public.refer_application(p_application_id uuid, p_team_id uuid, p_notes text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_source uuid; v_target public.teams;
begin
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_review_application_id(v_app.id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists(select 1 from public.recruitment_cycles c where c.id = v_app.cycle_id and c.season_id = private.active_season_id()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_app.stage <> 'interview' or not private.application_interview_completed(v_app.id) then raise exception 'interview_not_completed'; end if;
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

-- staff-actions sends the portal invite as the accepting user. Executives
-- may read only Associate invites attached to accepted applications in their
-- own team; this grants no general invitation creation or editing rights.
create function private.can_read_recruitment_invite(p_invite uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.applications a join public.invites i on i.id = a.invite_id
    where i.id = p_invite and a.stage = 'accepted' and i.role = 'associate'
      and i.team_id = a.accepted_team_id and private.can_manage_team(a.accepted_team_id))
$$;
create policy "Accepting managers read recruitment invites" on public.invites for select to authenticated
  using (private.can_read_recruitment_invite(id));
revoke all on function public.application_decision_context(uuid), public.refer_application(uuid, uuid, text) from public, anon;
grant execute on function public.application_decision_context(uuid), public.refer_application(uuid, uuid, text) to authenticated;

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
  if v_app.stage in ('accepted', 'withdrawn') then raise exception 'application_closed'; end if;
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

alter policy "Reviewers read CVs" on storage.objects
  using (bucket_id = 'applications' and exists(select 1 from public.applications a where a.cv_path = name and private.can_review_application_id(a.id)));
