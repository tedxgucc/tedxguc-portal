-- =====================================================================
-- 0001 · Core: seasons, divisions, teams, members, invites,
--        notifications, audit log, and the role-check helpers that
--        every row-level security policy uses.
-- Requirements: FR-2 (accounts), FR-3 (roles, teams, seasons),
--               FR-8.2 (in-app notifications), FR-14.3 (audit log)
-- =====================================================================

-- Helpers live in "private", which the Supabase API does not expose.
-- Roles still need USAGE so policies can call the helpers.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Small shared utilities
-- ---------------------------------------------------------------------
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Random token. Long = 64 hex chars (244 random bits), short = 32 (122 bits).
create function private.new_token(p_long boolean default true) returns text
language sql volatile set search_path = '' as $$
  select case when p_long
    then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    else replace(gen_random_uuid()::text, '-', '')
  end
$$;

create function private.hash_token(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create function private.try_uuid(p_text text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.member_role as enum ('chairman', 'curator', 'executive', 'associate');
create type public.membership_status as enum ('active', 'alumni', 'removed');
create type public.division_kind as enum ('talks', 'operations', 'org_development', 'marketing', 'other');
create type public.team_kind as enum (
  'coaching', 'research_production',
  'logistics_planning', 'partnerships',
  'associates_experience', 'associates_development',
  'campaigns_copyrights', 'media_design',
  'other'
);

-- ---------------------------------------------------------------------
-- Seasons, divisions, teams (FR-3.2)
-- "kind" gives each division/team a stable meaning across seasons, so
-- team-specific powers (e.g. L&P records cash outs) survive renames.
-- ---------------------------------------------------------------------
create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  year         int  not null unique check (year between 2013 and 2100),
  theme        text,
  is_active    boolean not null default false,
  activated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index seasons_only_one_active on public.seasons (is_active) where is_active;

create table public.divisions (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id),
  name       text not null,
  kind       public.division_kind not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name),
  unique (id, season_id)
);
create unique index divisions_one_kind_per_season on public.divisions (season_id, kind) where kind <> 'other';

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null,
  division_id uuid not null,
  name        text not null,
  kind        public.team_kind not null default 'other',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (division_id, season_id) references public.divisions (id, season_id),
  unique (season_id, name)
);
create unique index teams_one_kind_per_season on public.teams (season_id, kind) where kind <> 'other';
create index teams_division_idx on public.teams (division_id);

-- ---------------------------------------------------------------------
-- People (FR-2.5). Guests never get rows here.
-- Contact details live in a separate table so Associates can browse the
-- directory without seeing phone numbers (non-functional: privacy).
-- ---------------------------------------------------------------------
create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null,
  email        text not null unique,
  photo_url    text,
  major        text,
  semester     int check (semester between 1 and 12),
  birthday     date,
  social_links jsonb not null default '{}',
  fun_facts    jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_private (
  user_id        uuid primary key references public.users (id) on delete cascade,
  phone          text,
  whatsapp       text,
  personal_email text,
  updated_at     timestamptz not null default now()
);

-- One row per person per season (FR-3.1). Curators hold a division,
-- Executives and Associates hold a team (their division is filled in).
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  season_id   uuid not null references public.seasons (id),
  role        public.member_role not null,
  division_id uuid references public.divisions (id),
  team_id     uuid references public.teams (id),
  reports_to  uuid references public.users (id),
  status      public.membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint memberships_shape check (
       (role = 'chairman' and division_id is null and team_id is null)
    or (role = 'curator' and division_id is not null and team_id is null)
    or (role in ('executive', 'associate') and team_id is not null and division_id is not null)
  )
);
create unique index memberships_one_per_season on public.memberships (user_id, season_id) where status <> 'removed';
create unique index memberships_one_chairman on public.memberships (season_id) where role = 'chairman' and status <> 'removed';
create unique index memberships_one_curator on public.memberships (division_id) where role = 'curator' and status <> 'removed';
create index memberships_team_idx on public.memberships (team_id);

-- Invite-only accounts (FR-2.3).
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  season_id   uuid not null references public.seasons (id),
  role        public.member_role not null,
  division_id uuid references public.divisions (id),
  team_id     uuid references public.teams (id),
  invited_by  uuid references public.users (id) default auth.uid(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users (id),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint invites_shape check (
       (role = 'chairman' and division_id is null and team_id is null)
    or (role = 'curator' and division_id is not null and team_id is null)
    or (role in ('executive', 'associate') and team_id is not null and division_id is not null)
  )
);
create unique index invites_one_open_per_email on public.invites (email, season_id)
  where accepted_at is null and revoked_at is null;

-- Role change requests: Curators request, the Chairman decides (FR-3.6).
create table public.role_change_requests (
  id              uuid primary key default gen_random_uuid(),
  membership_id   uuid not null references public.memberships (id) on delete cascade,
  new_role        public.member_role,
  new_team_id     uuid references public.teams (id),
  new_division_id uuid references public.divisions (id),
  remove          boolean not null default false,
  reason          text,
  requested_by    uuid not null default auth.uid() references public.users (id),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by      uuid references public.users (id),
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (remove or new_role is not null)
);

-- Season-level settings, editable without code changes (FR-14.4).
create table public.settings (
  season_id  uuid not null references public.seasons (id),
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (season_id, key)
);

-- In-app notifications (FR-8.2). Rows are created by the database only.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Audit log (FR-14.3). Written by triggers only; nobody can edit it.
create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  action      text not null,
  target_type text not null,
  target_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

-- updated_at triggers
create trigger seasons_touch before update on public.seasons for each row execute function private.touch_updated_at();
create trigger divisions_touch before update on public.divisions for each row execute function private.touch_updated_at();
create trigger teams_touch before update on public.teams for each row execute function private.touch_updated_at();
create trigger users_touch before update on public.users for each row execute function private.touch_updated_at();
create trigger user_private_touch before update on public.user_private for each row execute function private.touch_updated_at();
create trigger memberships_touch before update on public.memberships for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Role-check helpers. Every helper takes the user id as its last
-- argument (default: the logged-in user) so server functions can reuse
-- the same rules for someone else, e.g. the calendar .ics feed.
-- SECURITY DEFINER lets them read memberships without looping back
-- into the memberships policies.
-- ---------------------------------------------------------------------
create function private.active_season_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.seasons where is_active
$$;

create function private.membership_of(p_uid uuid default auth.uid())
returns table (
  membership_id uuid, season_id uuid, role public.member_role,
  division_id uuid, team_id uuid,
  division_kind public.division_kind, team_kind public.team_kind
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.season_id, m.role, m.division_id, m.team_id, d.kind, t.kind
  from public.memberships m
  join public.seasons s on s.id = m.season_id and s.is_active
  left join public.divisions d on d.id = m.division_id
  left join public.teams t on t.id = m.team_id
  where m.user_id = p_uid and m.status = 'active'
  limit 1
$$;

create function private.my_role(p_uid uuid default auth.uid()) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from private.membership_of(p_uid)
$$;

create function private.is_member(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.membership_of(p_uid))
$$;

create function private.is_chairman(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.membership_of(p_uid) where role = 'chairman')
$$;

-- Current members and alumni (alumni keep read access to history).
create function private.has_any_membership(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships
    where user_id = p_uid and status in ('active', 'alumni')
  )
$$;

create function private.team_division(p_team uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select division_id from public.teams where id = p_team
$$;

-- Chairman, or the Curator of this division.
create function private.can_manage_division(p_division uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman' or (m.role = 'curator' and m.division_id = p_division)
  )
$$;

-- Chairman, the Curator of the team's division, or an Executive of the team.
create function private.can_manage_team(p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman'
       or (m.role = 'curator' and m.division_id = private.team_division(p_team))
       or (m.role = 'executive' and m.team_id = p_team)
  )
$$;

-- Anyone who manages the team, plus its Associates.
create function private.can_see_team(p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_team(p_team, p_uid)
      or exists (select 1 from private.membership_of(p_uid) m where m.team_id = p_team)
$$;

-- Any member (any role) of a division of this kind, e.g. 'operations'.
create function private.in_division_kind(p_kind public.division_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.membership_of(p_uid) m where m.division_kind = p_kind)
$$;

-- Chairman, or the Curator of the division of this kind.
create function private.leads_kind(p_kind public.division_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman' or (m.role = 'curator' and m.division_kind = p_kind)
  )
$$;

-- Member of a team of this kind with one of the given roles, e.g. L&P executives.
create function private.in_team_kind(
  p_kind public.team_kind,
  p_roles public.member_role[] default array['executive', 'associate']::public.member_role[],
  p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.team_kind = p_kind and m.role = any (p_roles)
  )
$$;

create function private.setting(p_key text, p_default jsonb default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value from public.settings where season_id = private.active_season_id() and key = p_key),
    p_default)
$$;

-- Create notifications (FR-8.2). Skips nulls and duplicates.
create function private.notify(
  p_user_ids uuid[], p_type text, p_title text, p_body text default null, p_link text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select distinct u, p_type, p_title, p_body, p_link
  from unnest(p_user_ids) as u
  where u is not null
$$;

-- Generic audit trigger (FR-14.3).
create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (user_id, action, target_type, target_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

create function private.log_action(p_action text, p_target_type text, p_target_id text, p_details jsonb default null)
returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, action, target_type, target_id, after)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_details)
$$;

create trigger seasons_audit after insert or update or delete on public.seasons for each row execute function private.audit();
create trigger divisions_audit after insert or update or delete on public.divisions for each row execute function private.audit();
create trigger teams_audit after insert or update or delete on public.teams for each row execute function private.audit();
create trigger memberships_audit after insert or update or delete on public.memberships for each row execute function private.audit();
create trigger invites_audit after insert or update or delete on public.invites for each row execute function private.audit();
create trigger role_change_requests_audit after insert or update or delete on public.role_change_requests for each row execute function private.audit();
create trigger settings_audit after insert or update or delete on public.settings for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Keep memberships and invites consistent: Executives and Associates
-- get their division from their team; everything must be in one season.
-- ---------------------------------------------------------------------
create function private.fill_division_from_team() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_season uuid;
begin
  if new.team_id is not null then
    select t.division_id, t.season_id into new.division_id, v_season
    from public.teams t where t.id = new.team_id;
  elsif new.division_id is not null then
    select d.season_id into v_season from public.divisions d where d.id = new.division_id;
  end if;
  if v_season is not null and v_season <> new.season_id then
    raise exception 'team_or_division_in_other_season';
  end if;
  return new;
end $$;

create trigger memberships_fill before insert or update on public.memberships
  for each row execute function private.fill_division_from_team();
create trigger invites_fill before insert or update on public.invites
  for each row execute function private.fill_division_from_team();

-- An expired, unused invite for the same email and season is closed
-- automatically so the person can be invited again.
create function private.invites_close_expired() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  update public.invites
     set revoked_at = now()
   where email = new.email and season_id = new.season_id
     and accepted_at is null and revoked_at is null and expires_at <= now();
  return new;
end $$;
create trigger invites_close_expired before insert on public.invites
  for each row execute function private.invites_close_expired();

-- Inviting someone who already has an account (e.g. a returning member
-- for a new season) gives them the membership right away.
create function private.invites_apply_to_existing_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  select id into v_user from public.users where email = new.email;
  if v_user is null then
    return null;
  end if;
  insert into public.memberships (user_id, season_id, role, division_id, team_id)
  values (v_user, new.season_id, new.role, new.division_id, new.team_id);
  update public.invites set accepted_at = now(), accepted_by = v_user where id = new.id;
  perform private.notify(array[v_user], 'role_assigned', 'You have a new role in TEDxGUC', null, '/portal');
  return null;
end $$;
create trigger invites_apply_to_existing_user after insert on public.invites
  for each row execute function private.invites_apply_to_existing_user();

-- ---------------------------------------------------------------------
-- Sign-up rules (FR-2.1, FR-2.3)
-- Wired as Supabase's "before user created" auth hook in config.toml.
-- Blocks any account without an open invite, and Google accounts
-- outside the GUC domains.
-- ---------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email    text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', 'email');
  v_domains  text[] := array['student.guc.edu.eg', 'guc.edu.eg'];
begin
  if v_provider = 'google' and split_part(v_email, '@', 2) <> all (v_domains) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign in with your GUC email (@student.guc.edu.eg or @guc.edu.eg).'));
  end if;

  if not exists (
    select 1 from public.invites
    where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'The TEDxGUC portal is invite-only. Ask your Curator or the Chairman for an invite.'));
  end if;

  return '{}'::jsonb;
end $$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- On first login: create the profile and turn the invite into a membership.
create function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email  text := lower(new.email);
  v_invite public.invites;
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(v_email, '@', 1)),
    v_email);
  insert into public.user_private (user_id) values (new.id);

  select * into v_invite from public.invites
  where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    insert into public.memberships (user_id, season_id, role, division_id, team_id)
    values (new.id, v_invite.season_id, v_invite.role, v_invite.division_id, v_invite.team_id);
    update public.invites set accepted_at = now(), accepted_by = new.id where id = v_invite.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Keep the profile email in sync when a member changes their login
-- email, e.g. to a personal email before graduating (FR-2.6).
create function private.handle_auth_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users set email = lower(new.email) where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_auth_email_change();

-- ---------------------------------------------------------------------
-- Actions (called from the app)
-- ---------------------------------------------------------------------

-- Season rollover (FR-3.4): the current Chairman switches to a prepared
-- season. Everyone still active in the old season becomes alumni.
create function public.activate_season(p_season_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid := private.active_season_id();
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_season_id = v_old then
    raise exception 'season_already_active';
  end if;
  if not exists (
    select 1 from public.memberships
    where season_id = p_season_id and role = 'chairman' and status = 'active'
  ) then
    raise exception 'new_season_needs_chairman';
  end if;

  update public.memberships set status = 'alumni' where season_id = v_old and status = 'active';
  update public.seasons set is_active = false where id = v_old;
  update public.seasons set is_active = true, activated_at = now() where id = p_season_id;
  perform private.log_action('season_rollover', 'seasons', p_season_id::text,
    jsonb_build_object('from', v_old, 'to', p_season_id));
end $$;

-- The Chairman approves or rejects a Curator's role change request (FR-3.6).
create function public.decide_role_change(p_request_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.role_change_requests;
  v_member public.memberships;
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_req from public.role_change_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  if p_approve then
    select * into v_member from public.memberships where id = v_req.membership_id for update;
    if v_req.remove then
      update public.memberships set status = 'removed' where id = v_member.id;
    else
      update public.memberships
         set role = v_req.new_role,
             team_id = case when v_req.new_role in ('executive', 'associate')
                            then coalesce(v_req.new_team_id, v_member.team_id) end,
             division_id = case when v_req.new_role = 'curator'
                                then coalesce(v_req.new_division_id, v_member.division_id) end
       where id = v_member.id;
    end if;
    perform private.notify(array[v_member.user_id], 'role_changed', 'Your TEDxGUC role was updated', null, '/portal/profile');
  end if;

  update public.role_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request_id;
  perform private.notify(array[v_req.requested_by], 'role_change_decided',
    case when p_approve then 'Role change approved' else 'Role change rejected' end, null, '/portal/team');
end $$;

-- Current board for the public About page (FR-1.2). Names and photos only.
create function public.get_public_board()
returns table (name text, photo_url text, role public.member_role, division text, team text)
language sql stable security definer set search_path = '' as $$
  select u.name, u.photo_url, m.role, d.name, t.name
  from public.memberships m
  join public.seasons s on s.id = m.season_id and s.is_active
  join public.users u on u.id = m.user_id
  left join public.divisions d on d.id = m.division_id
  left join public.teams t on t.id = m.team_id
  where m.status = 'active' and m.role in ('chairman', 'curator', 'executive')
  order by array_position(array['chairman', 'curator', 'executive']::public.member_role[], m.role), d.name, t.name, u.name
$$;

create function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids))
$$;

-- Org chart (FR-3.5): the app draws the tree from these rows.
create view public.org_chart with (security_invoker = true) as
  select m.id as membership_id, m.season_id, m.user_id, u.name, u.photo_url,
         m.role, m.division_id, d.name as division, d.kind as division_kind,
         m.team_id, t.name as team, t.kind as team_kind, m.reports_to, m.status
  from public.memberships m
  join public.users u on u.id = m.user_id
  left join public.divisions d on d.id = m.division_id
  left join public.teams t on t.id = m.team_id
  where m.status <> 'removed';

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.teams enable row level security;
alter table public.users enable row level security;
alter table public.user_private enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.role_change_requests enable row level security;
alter table public.settings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Seasons, divisions, teams: names are public (the site shows teams on
-- "Join the team"); only the Chairman changes them.
create policy "Anyone reads seasons" on public.seasons for select to anon, authenticated using (true);
create policy "Chairman adds seasons" on public.seasons for insert to authenticated
  with check ((select private.is_chairman()) and not is_active);
create policy "Chairman edits seasons" on public.seasons for update to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));
-- Activation only happens through activate_season().
revoke update on public.seasons from anon, authenticated;
grant update (year, theme) on public.seasons to authenticated;

create policy "Anyone reads divisions" on public.divisions for select to anon, authenticated using (true);
create policy "Chairman manages divisions" on public.divisions for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));

create policy "Anyone reads teams" on public.teams for select to anon, authenticated using (true);
create policy "Chairman manages teams" on public.teams for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));

-- Directory (FR-2.5): members and alumni read profiles; people edit their own.
create policy "Members read profiles" on public.users for select to authenticated
  using ((select private.has_any_membership()) or id = (select auth.uid()));
create policy "Members edit own profile" on public.users for update to authenticated
  using (id = (select auth.uid()) or (select private.is_chairman()))
  with check (id = (select auth.uid()) or (select private.is_chairman()));
revoke insert, update, delete on public.users from anon, authenticated;
grant update (name, photo_url, major, semester, birthday, social_links, fun_facts) on public.users to authenticated;

-- Phone numbers: yourself, or Executives and above.
create policy "Contact details for self and board" on public.user_private for select to authenticated
  using (user_id = (select auth.uid())
         or (select private.my_role()) in ('chairman', 'curator', 'executive'));
create policy "Members edit own contact details" on public.user_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_private from anon, authenticated;
grant update (phone, whatsapp, personal_email) on public.user_private to authenticated;

-- Memberships: everyone in the club can see the structure; the Chairman edits it.
create policy "Members read memberships" on public.memberships for select to authenticated
  using ((select private.has_any_membership()));
create policy "Chairman manages memberships" on public.memberships for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));

-- Invites: the Chairman invites anyone; a Curator invites Executives and
-- Associates to teams in their own division, for the current season.
create function private.can_invite(
  p_role public.member_role, p_division uuid, p_season uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_chairman(p_uid)
      or (p_role in ('executive', 'associate')
          and p_season = private.active_season_id()
          and exists (select 1 from private.membership_of(p_uid) m
                      where m.role = 'curator' and m.division_id = p_division))
$$;

create policy "Board reads invites" on public.invites for select to authenticated
  using (invited_by = (select auth.uid())
         or (select private.is_chairman())
         or (division_id is not null and private.can_manage_division(division_id)));
create policy "Chairman and Curators invite" on public.invites for insert to authenticated
  with check (invited_by = (select auth.uid())
              and private.can_invite(role, division_id, season_id));
create policy "Inviters revoke invites" on public.invites for update to authenticated
  using (invited_by = (select auth.uid()) or (select private.is_chairman()))
  with check (invited_by = (select auth.uid()) or (select private.is_chairman()));
revoke update, delete on public.invites from anon, authenticated;
grant update (revoked_at) on public.invites to authenticated;

-- Role change requests: Curators ask for members of their own division.
create policy "Requester and Chairman read requests" on public.role_change_requests for select to authenticated
  using (requested_by = (select auth.uid()) or (select private.is_chairman()));
create policy "Curators request role changes" on public.role_change_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.memberships m
      where m.id = membership_id
        and m.season_id = private.active_season_id()
        and private.can_manage_division(m.division_id)
    ));
revoke update, delete on public.role_change_requests from anon, authenticated;

create policy "Members read settings" on public.settings for select to authenticated
  using ((select private.has_any_membership()));
create policy "Chairman manages settings" on public.settings for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));

create policy "Own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Chairman reads audit log" on public.audit_log for select to authenticated
  using ((select private.is_chairman()));
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
