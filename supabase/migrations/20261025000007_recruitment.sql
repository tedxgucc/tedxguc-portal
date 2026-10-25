-- =====================================================================
-- 0007 · Recruitment: cycles, open positions, applications, interview
--        slots and scores, board season plans.
-- Requirements: FR-4.1–FR-4.8
--
-- Applicants are guests: they apply through the public-forms server
-- function and follow their application with a private status link.
-- Reviewers: the Chairman, the Curator of the division, and Executives
-- of the teams the applicant chose. Only the Chairman and Curators decide.
-- =====================================================================

create type public.cycle_kind as enum ('associates', 'board');
create type public.application_stage as enum ('applied', 'screened', 'interview', 'accepted', 'rejected', 'withdrawn');

create table public.recruitment_cycles (
  id                     uuid primary key default gen_random_uuid(),
  season_id              uuid not null references public.seasons (id) default private.active_season_id(),
  name                   text not null,
  kind                   public.cycle_kind not null default 'associates',
  opens_at               timestamptz not null,
  closes_at              timestamptz not null,
  rejections_released_at timestamptz,
  created_by             uuid references public.users (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (closes_at > opens_at)
);
create trigger recruitment_cycles_touch before update on public.recruitment_cycles
  for each row execute function private.touch_updated_at();

-- Open roles per team, with that team's own questions (FR-4.1, FR-4.2).
-- questions: [{"id": "q1", "label": "Why Media?", "kind": "textarea", "required": true}]
create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references public.recruitment_cycles (id) on delete cascade,
  team_id     uuid not null references public.teams (id),
  seats       int check (seats > 0),
  description text,
  questions   jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (cycle_id, team_id)
);

create table public.applications (
  id                    uuid primary key default gen_random_uuid(),
  cycle_id              uuid not null references public.recruitment_cycles (id),
  applicant_name        text not null,
  applicant_email       text not null check (applicant_email = lower(applicant_email)),
  applicant_phone       text,
  team_choices          uuid[] not null check (cardinality(team_choices) between 1 and 2),
  answers               jsonb not null default '{}',
  cv_path               text,
  stage                 public.application_stage not null default 'applied',
  accepted_team_id      uuid references public.teams (id),
  invite_id             uuid references public.invites (id),
  status_token_hash     text not null unique,
  consent_at            timestamptz not null,
  rejection_notified_at timestamptz,
  decided_by            uuid references public.users (id),
  stage_changed_at      timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index applications_one_per_email on public.applications (cycle_id, applicant_email) where stage <> 'withdrawn';
create index applications_team_choices_idx on public.applications using gin (team_choices);
create trigger applications_touch before update on public.applications
  for each row execute function private.touch_updated_at();

create table public.interview_slots (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references public.recruitment_cycles (id) on delete cascade,
  team_id         uuid not null references public.teams (id),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  location        text,
  interviewer_ids uuid[] not null default '{}',
  application_id  uuid unique references public.applications (id) on delete set null,
  booked_at       timestamptz,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index interview_slots_cycle_idx on public.interview_slots (cycle_id, team_id, starts_at);

create table public.interview_scores (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  interviewer_id uuid not null default auth.uid() references public.users (id),
  score          numeric(4, 1) not null check (score between 0 and 10),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, interviewer_id)
);
create trigger interview_scores_touch before update on public.interview_scores
  for each row execute function private.touch_updated_at();

-- Board candidates' season plans (FR-4.7). Candidates are current members.
-- answers holds the general section (personal info, mission and vision,
-- job description, timeline, team dynamics, associates plan, KPIs) plus
-- the team's own questions from positions.questions.
create table public.board_plans (
  id             uuid primary key default gen_random_uuid(),
  cycle_id       uuid not null references public.recruitment_cycles (id),
  user_id        uuid not null default auth.uid() references public.users (id),
  target_role    public.member_role not null check (target_role in ('executive', 'curator')),
  team_id        uuid references public.teams (id),
  division_id    uuid references public.divisions (id),
  answers        jsonb not null default '{}',
  status         text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at   timestamptz,
  score          numeric(4, 1) check (score between 0 and 10),
  reviewer_notes text,
  scored_by      uuid references public.users (id),
  scored_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (cycle_id, user_id),
  check ((target_role = 'executive' and team_id is not null) or (target_role = 'curator' and division_id is not null))
);
create trigger board_plans_touch before update on public.board_plans
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Chairman, Curator of a chosen team's division, or Executive of a chosen team.
create function private.can_review_application(p_team_choices uuid[], p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from unnest(p_team_choices) t where private.can_manage_team(t, p_uid))
$$;

-- Chairman, or Curator of a chosen team's division.
create function private.can_decide_application(p_team_choices uuid[], p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_chairman(p_uid)
      or exists (select 1 from unnest(p_team_choices) t
                 where private.can_manage_division(private.team_division(t), p_uid))
$$;

create function private.can_review_application_id(p_app uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications a
                 where a.id = p_app and private.can_review_application(a.team_choices, p_uid))
$$;

-- What applicants see. Rejections stay "in review" until released (FR-4.6).
create function private.public_stage(p_stage public.application_stage, p_released boolean) returns text
language sql immutable set search_path = '' as $$
  select case p_stage
    when 'applied' then 'received'
    when 'screened' then 'in_review'
    when 'interview' then 'interview'
    when 'accepted' then 'accepted'
    when 'rejected' then case when p_released then 'not_selected' else 'in_review' end
    when 'withdrawn' then 'withdrawn'
  end
$$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.recruitment_cycles enable row level security;
alter table public.positions enable row level security;
alter table public.applications enable row level security;
alter table public.interview_slots enable row level security;
alter table public.interview_scores enable row level security;
alter table public.board_plans enable row level security;

-- Cycles and open positions are public ("Join the team", FR-1.6).
create policy "Anyone reads cycles" on public.recruitment_cycles for select to anon, authenticated using (true);
create policy "Chairman manages cycles" on public.recruitment_cycles for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));
revoke update on public.recruitment_cycles from anon, authenticated;
grant update (name, kind, opens_at, closes_at) on public.recruitment_cycles to authenticated;

create policy "Anyone reads positions" on public.positions for select to anon, authenticated using (true);
create policy "Curators manage their positions" on public.positions for all to authenticated
  using (private.can_manage_division(private.team_division(team_id)))
  with check (private.can_manage_division(private.team_division(team_id)));

create policy "Reviewers read applications" on public.applications for select to authenticated
  using (private.can_review_application(team_choices));
revoke all on public.applications from anon, authenticated;
grant select (id, cycle_id, applicant_name, applicant_email, applicant_phone, team_choices, answers,
              cv_path, stage, accepted_team_id, invite_id, consent_at, decided_by, stage_changed_at,
              created_at, updated_at) on public.applications to authenticated;

create policy "Reviewers read slots" on public.interview_slots for select to authenticated
  using (private.can_manage_team(team_id));
create policy "Reviewers manage slots" on public.interview_slots for all to authenticated
  using (private.can_manage_team(team_id)) with check (private.can_manage_team(team_id));
revoke update on public.interview_slots from anon, authenticated;
grant update (starts_at, ends_at, location, interviewer_ids) on public.interview_slots to authenticated;

create policy "Reviewers read scores" on public.interview_scores for select to authenticated
  using (private.can_review_application_id(application_id));
create policy "Reviewers add own score" on public.interview_scores for insert to authenticated
  with check (interviewer_id = (select auth.uid()) and private.can_review_application_id(application_id));
create policy "Reviewers edit own score" on public.interview_scores for update to authenticated
  using (interviewer_id = (select auth.uid())) with check (interviewer_id = (select auth.uid()));
revoke update on public.interview_scores from anon, authenticated;
grant update (score, notes) on public.interview_scores to authenticated;

create policy "Own plan; Chairman reads all" on public.board_plans for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_chairman()));
create policy "Members start a plan in an open board cycle" on public.board_plans for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and status = 'draft'
    and exists (select 1 from public.recruitment_cycles c
                where c.id = cycle_id and c.kind = 'board' and now() between c.opens_at and c.closes_at));
create policy "Candidates edit own draft" on public.board_plans for update to authenticated
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()));
revoke update, delete on public.board_plans from anon, authenticated;
grant update (target_role, team_id, division_id, answers, status) on public.board_plans to authenticated;

-- Submitting stamps the time; nothing changes after the cycle closes.
create function private.board_plans_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.status <> old.status then
    if new.status = 'submitted' then
      if not exists (select 1 from public.recruitment_cycles c where c.id = new.cycle_id and now() <= c.closes_at) then
        raise exception 'cycle_closed';
      end if;
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger board_plans_before_update before update on public.board_plans
  for each row execute function private.board_plans_before_update();

-- ---------------------------------------------------------------------
-- Applicant actions (guests)
-- ---------------------------------------------------------------------

-- Service role only: called by public-forms after spam checks.
create function public.submit_application(
  p_cycle_id uuid, p_name text, p_email text, p_phone text,
  p_team_choices uuid[], p_answers jsonb default '{}', p_cv_path text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.recruitment_cycles;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_name, ''));
  v_token text := private.new_token();
  v_q     jsonb;
  v_id    uuid;
begin
  select * into v_cycle from public.recruitment_cycles where id = p_cycle_id;
  if not found or v_cycle.kind <> 'associates' or now() not between v_cycle.opens_at and v_cycle.closes_at then
    raise exception 'cycle_not_open';
  end if;
  if v_name = '' or length(v_name) > 120 then raise exception 'invalid_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_team_choices is null or cardinality(p_team_choices) not between 1 and 2
     or cardinality(p_team_choices) <> (select count(distinct t) from unnest(p_team_choices) t) then
    raise exception 'invalid_team_choices';
  end if;
  if exists (select 1 from unnest(p_team_choices) t
             where not exists (select 1 from public.positions p
                               where p.cycle_id = p_cycle_id and p.team_id = t and p.is_open)) then
    raise exception 'team_not_recruiting';
  end if;
  for v_q in
    select q from public.positions p, jsonb_array_elements(p.questions) q
    where p.cycle_id = p_cycle_id and p.team_id = any (p_team_choices)
      and coalesce((q ->> 'required')::boolean, false)
  loop
    if coalesce(trim(p_answers ->> (v_q ->> 'id')), '') = '' then
      raise exception 'missing_field:%', v_q ->> 'label';
    end if;
  end loop;
  if p_cv_path is not null and p_cv_path !~ ('^cv/' || p_cycle_id::text || '/[0-9a-f-]{36}\.pdf$') then
    raise exception 'invalid_cv';
  end if;
  if exists (select 1 from public.applications
             where cycle_id = p_cycle_id and applicant_email = v_email and stage <> 'withdrawn') then
    raise exception 'already_applied';
  end if;

  insert into public.applications (cycle_id, applicant_name, applicant_email, applicant_phone,
                                   team_choices, answers, cv_path, status_token_hash, consent_at)
  values (p_cycle_id, v_name, v_email, nullif(trim(p_phone), ''), p_team_choices,
          coalesce(p_answers, '{}'), p_cv_path, private.hash_token(v_token), now())
  returning id into v_id;

  -- Tell the Executives of the chosen teams.
  perform private.notify(
    array(select m.user_id from public.memberships m
          where m.team_id = any (p_team_choices) and m.role = 'executive' and m.status = 'active'),
    'new_application', 'New application: ' || v_name, null, '/portal/recruitment/' || v_id);

  return jsonb_build_object('application_id', v_id, 'status_token', v_token,
                            'applicant_name', v_name, 'applicant_email', v_email, 'cycle_name', v_cycle.name);
end $$;

-- Applicant status page (anyone with the token).
create function public.get_application_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'application_id', a.id,
    'applicant_name', a.applicant_name,
    'cycle', c.name,
    'stage', private.public_stage(a.stage, c.rejections_released_at is not null or a.rejection_notified_at is not null),
    'teams', (select jsonb_agg(t.name order by array_position(a.team_choices, t.id))
              from public.teams t where t.id = any (a.team_choices)),
    'interview', (select jsonb_build_object('slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                                            'location', s.location, 'team', t.name)
                  from public.interview_slots s join public.teams t on t.id = s.team_id
                  where s.application_id = a.id),
    'open_slots', case when a.stage = 'interview' then coalesce((
        select jsonb_agg(jsonb_build_object('slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                                            'location', s.location, 'team', t.name) order by s.starts_at)
        from public.interview_slots s join public.teams t on t.id = s.team_id
        where s.cycle_id = a.cycle_id and s.team_id = any (a.team_choices)
          and s.application_id is null and s.starts_at > now() + interval '1 hour'), '[]'::jsonb) end)
  from public.applications a
  join public.recruitment_cycles c on c.id = a.cycle_id
  where a.status_token_hash = private.hash_token(p_status_token)
$$;

-- Applicant books (or moves) their interview slot (FR-4.4).
create function public.book_interview_slot(p_status_token text, p_slot_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
  v_slot public.interview_slots;
begin
  select * into v_app from public.applications
  where status_token_hash = private.hash_token(p_status_token) for update;
  if not found then raise exception 'not_found'; end if;
  if v_app.stage <> 'interview' then raise exception 'not_invited_to_interview'; end if;

  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found or v_slot.cycle_id <> v_app.cycle_id or not (v_slot.team_id = any (v_app.team_choices)) then
    raise exception 'slot_not_found';
  end if;
  if v_slot.application_id is not null and v_slot.application_id <> v_app.id then
    raise exception 'slot_taken';
  end if;
  if v_slot.starts_at <= now() + interval '1 hour' then
    raise exception 'slot_too_soon';
  end if;

  update public.interview_slots set application_id = null, booked_at = null
   where application_id = v_app.id and id <> p_slot_id;
  update public.interview_slots set application_id = v_app.id, booked_at = now() where id = p_slot_id;

  perform private.notify(v_slot.interviewer_ids, 'interview_booked',
    'Interview booked: ' || v_app.applicant_name, null, '/portal/recruitment/' || v_app.id);
  return jsonb_build_object('slot_id', v_slot.id, 'starts_at', v_slot.starts_at, 'location', v_slot.location);
end $$;

create function public.withdraw_application(p_status_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.applications set stage = 'withdrawn', stage_changed_at = now()
   where status_token_hash = private.hash_token(p_status_token) and stage not in ('accepted', 'withdrawn');
  if not found then raise exception 'not_found'; end if;
  update public.interview_slots set application_id = null, booked_at = null
   where application_id = (select id from public.applications where status_token_hash = private.hash_token(p_status_token));
end $$;

-- ---------------------------------------------------------------------
-- Reviewer actions
-- ---------------------------------------------------------------------

-- Move applications between stages, in bulk (FR-4.3). Returns who to
-- email; rejections are held back until released (FR-4.6).
create function public.set_application_stage(p_ids uuid[], p_stage public.application_stage) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app record;
  v_out jsonb := '[]';
  v_released boolean;
begin
  if p_stage not in ('applied', 'screened', 'interview', 'rejected') then
    raise exception 'use_accept_application';
  end if;
  for v_app in
    select a.*, c.rejections_released_at, c.name as cycle_name
    from public.applications a join public.recruitment_cycles c on c.id = a.cycle_id
    where a.id = any (p_ids)
    for update of a
  loop
    if not private.can_decide_application(v_app.team_choices) then
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

-- Send all held-back rejections for a cycle (FR-4.6). Returns who to email.
create function public.release_rejections(p_cycle_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_out jsonb;
begin
  if private.my_role() not in ('chairman', 'curator') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.recruitment_cycles set rejections_released_at = coalesce(rejections_released_at, now())
   where id = p_cycle_id;
  with released as (
    update public.applications a set rejection_notified_at = now()
     where a.cycle_id = p_cycle_id and a.stage = 'rejected' and a.rejection_notified_at is null
    returning a.id, a.applicant_name, a.applicant_email
  )
  select coalesce(jsonb_agg(jsonb_build_object('application_id', r.id, 'applicant_name', r.applicant_name,
                                               'applicant_email', r.applicant_email, 'cycle_name', c.name,
                                               'stage', 'rejected')), '[]')
    into v_out
  from released r, public.recruitment_cycles c where c.id = p_cycle_id;
  return v_out;
end $$;

-- Accept: creates the Associate invite in one step (FR-4.5).
create function public.accept_application(p_application_id uuid, p_team_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
  v_team uuid;
  v_season uuid;
  v_invite uuid;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_decide_application(v_app.team_choices) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_app.stage in ('accepted', 'withdrawn') then raise exception 'application_closed'; end if;
  v_team := coalesce(p_team_id, v_app.team_choices[1]);
  if not (v_team = any (v_app.team_choices)) then raise exception 'team_not_chosen'; end if;
  if not (private.is_chairman() or private.can_manage_division(private.team_division(v_team))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select season_id into v_season from public.recruitment_cycles where id = v_app.cycle_id;
  select id into v_invite from public.invites
  where email = v_app.applicant_email and season_id = v_season and accepted_at is null and revoked_at is null;
  if v_invite is null then
    insert into public.invites (email, season_id, role, team_id, invited_by)
    values (v_app.applicant_email, v_season, 'associate', v_team, auth.uid())
    returning id into v_invite;
  end if;

  update public.applications
     set stage = 'accepted', accepted_team_id = v_team, invite_id = v_invite,
         decided_by = auth.uid(), stage_changed_at = now()
   where id = v_app.id;

  return jsonb_build_object('application_id', v_app.id, 'invite_id', v_invite,
    'applicant_name', v_app.applicant_name, 'applicant_email', v_app.applicant_email,
    'team', (select name from public.teams where id = v_team), 'stage', 'accepted');
end $$;

-- The Chairman scores a submitted board plan (FR-4.7).
create function public.score_board_plan(p_plan_id uuid, p_score numeric, p_notes text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.board_plans
     set score = p_score, reviewer_notes = p_notes, scored_by = auth.uid(), scored_at = now()
   where id = p_plan_id and status = 'submitted';
  if not found then raise exception 'plan_not_submitted'; end if;
end $$;

-- Delete applicant data 6 months after a cycle closes (FR-4.8).
-- Returns CV file paths so the maintenance function can delete the files.
create function public.purge_old_applications() returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
begin
  with gone as (
    delete from public.applications a
    using public.recruitment_cycles c
    where c.id = a.cycle_id and c.closes_at < now() - interval '6 months' and a.stage <> 'accepted'
    returning a.cv_path
  )
  select coalesce(array_agg(cv_path) filter (where cv_path is not null), '{}') into v_paths from gone;
  return v_paths;
end $$;

-- CVs: private bucket, uploaded through a signed link from public-forms.
insert into storage.buckets (id, name, public) values ('applications', 'applications', false)
on conflict (id) do nothing;

create policy "Reviewers read CVs" on storage.objects for select to authenticated
  using (bucket_id = 'applications'
         and exists (select 1 from public.applications a
                     where a.cv_path = name and private.can_review_application(a.team_choices)));

-- Grants
revoke execute on function public.submit_application(uuid, text, text, text, uuid[], jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_application(uuid, text, text, text, uuid[], jsonb, text) to service_role;
revoke execute on function public.purge_old_applications() from public, anon, authenticated;
grant execute on function public.purge_old_applications() to service_role;
revoke execute on function public.set_application_stage(uuid[], public.application_stage) from public, anon;
revoke execute on function public.release_rejections(uuid) from public, anon;
revoke execute on function public.accept_application(uuid, uuid) from public, anon;
revoke execute on function public.score_board_plan(uuid, numeric, text) from public, anon;
revoke all on public.applications, public.interview_slots, public.interview_scores, public.board_plans from anon;
