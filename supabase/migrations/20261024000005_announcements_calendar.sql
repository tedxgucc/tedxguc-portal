-- =====================================================================
-- 0005 · Announcements and the shared calendar
-- Requirements: FR-8.1, FR-15.1–FR-15.9
-- =====================================================================

-- ---------------------------------------------------------------------
-- Announcements (FR-8.1)
-- Chairman → anyone, including a whole role · Curator → own division or
-- one of its teams · Executive → own team.
-- ---------------------------------------------------------------------
create type public.audience_type as enum ('all', 'division', 'team', 'role');

create table public.announcements (
  id                 uuid primary key default gen_random_uuid(),
  season_id          uuid not null references public.seasons (id) default private.active_season_id(),
  author_id          uuid not null default auth.uid() references public.users (id),
  audience_type      public.audience_type not null,
  division_id        uuid references public.divisions (id),
  team_id            uuid references public.teams (id),
  audience_role      public.member_role,
  title              text not null check (length(trim(title)) > 0),
  body               text not null,
  pinned             boolean not null default false,
  needs_confirmation boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint announcements_audience check (
       (audience_type = 'all' and division_id is null and team_id is null and audience_role is null)
    or (audience_type = 'division' and division_id is not null and team_id is null and audience_role is null)
    or (audience_type = 'team' and team_id is not null and division_id is null and audience_role is null)
    or (audience_type = 'role' and audience_role is not null and division_id is null and team_id is null)
  )
);
create index announcements_season_idx on public.announcements (season_id, created_at desc);
create trigger announcements_touch before update on public.announcements
  for each row execute function private.touch_updated_at();

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id         uuid not null default auth.uid() references public.users (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create function private.can_post_announcement(
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
  )
$$;

-- Is this member in the announcement's audience?
create function private.in_audience(
  p_type public.audience_type, p_division uuid, p_team uuid, p_role public.member_role,
  p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where p_type = 'all'
       or (p_type = 'division' and m.division_id = p_division)
       or (p_type = 'team' and (m.team_id = p_team
                                or (m.role = 'curator' and m.division_id = private.team_division(p_team))))
       or (p_type = 'role' and m.role = p_role)
  )
$$;

create function private.can_see_announcement(p_id uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.announcements a
    where a.id = p_id
      and (a.author_id = p_uid
           or private.is_chairman(p_uid)
           or (a.season_id = private.active_season_id()
               and private.in_audience(a.audience_type, a.division_id, a.team_id, a.audience_role, p_uid))))
$$;

-- Notify the audience when an announcement is posted.
create function private.announcements_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(
    array(
      select m.user_id from public.memberships m
      where m.season_id = new.season_id and m.status = 'active' and m.user_id <> new.author_id
        and private.in_audience(new.audience_type, new.division_id, new.team_id, new.audience_role, m.user_id)),
    'announcement', new.title, left(new.body, 200), '/portal/announcements/' || new.id);
  return null;
end $$;
create trigger announcements_notify after insert on public.announcements
  for each row execute function private.announcements_notify();

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

create policy "Audience reads announcements" on public.announcements for select to authenticated
  using (author_id = (select auth.uid())
         or (select private.is_chairman())
         or (season_id = (select private.active_season_id())
             and private.in_audience(audience_type, division_id, team_id, audience_role)));
create policy "Board posts announcements" on public.announcements for insert to authenticated
  with check (author_id = (select auth.uid())
              and season_id = (select private.active_season_id())
              and private.can_post_announcement(audience_type, division_id, team_id));
create policy "Authors edit announcements" on public.announcements for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_chairman()))
  with check (private.can_post_announcement(audience_type, division_id, team_id));
create policy "Authors delete announcements" on public.announcements for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_chairman()));
revoke update on public.announcements from anon, authenticated;
grant update (title, body, pinned, needs_confirmation) on public.announcements to authenticated;

create policy "Read own confirmations; authors see who read" on public.announcement_reads for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.announcements a
                    where a.id = announcement_id
                      and (a.author_id = (select auth.uid()) or (select private.is_chairman()))));
create policy "Confirm reading" on public.announcement_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_announcement(announcement_id));
revoke update, delete on public.announcement_reads from anon, authenticated;

-- ---------------------------------------------------------------------
-- Calendar (FR-15)
-- club   → every member · team → that team, its Curator, the Chairman
-- public → also guests, on the public calendar page (FR-15.8)
-- ---------------------------------------------------------------------
create type public.calendar_visibility as enum ('club', 'team', 'public');

create table public.calendar_entries (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) default private.active_season_id(),
  created_by       uuid not null default auth.uid() references public.users (id),
  team_id          uuid references public.teams (id),
  visibility       public.calendar_visibility not null,
  title            text not null check (length(trim(title)) > 0),
  description      text,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  all_day          boolean not null default false,
  location         text,
  online_url       text,
  linked_type      text check (linked_type in ('meeting', 'event', 'task')),
  linked_id        uuid,
  reminder_minutes int check (reminder_minutes between 0 and 10080),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((visibility = 'team') = (team_id is not null)),
  check (ends_at is null or ends_at >= starts_at),
  check ((linked_type is null) = (linked_id is null))
);
create index calendar_entries_range_idx on public.calendar_entries (starts_at);
create trigger calendar_entries_touch before update on public.calendar_entries
  for each row execute function private.touch_updated_at();

-- Who may create or edit an entry with this visibility and team.
create function private.can_write_calendar(
  p_visibility public.calendar_visibility, p_team uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_visibility in ('club', 'public') then private.my_role(p_uid) in ('chairman', 'curator')
    else private.can_manage_team(p_team, p_uid)
  end
$$;

-- Who may see an entry.
create function private.can_see_calendar_entry(
  p_visibility public.calendar_visibility, p_team uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_visibility = 'public' then true
    when p_visibility = 'club' then private.is_member(p_uid)
    else private.can_see_team(p_team, p_uid)
  end
$$;

alter table public.calendar_entries enable row level security;

create policy "Guests read public entries" on public.calendar_entries for select to anon
  using (visibility = 'public');
create policy "Members read their entries" on public.calendar_entries for select to authenticated
  using (private.can_see_calendar_entry(visibility, team_id));
create policy "Board creates entries" on public.calendar_entries for insert to authenticated
  with check (created_by = (select auth.uid())
              and season_id = (select private.active_season_id())
              and private.can_write_calendar(visibility, team_id));
-- Club-wide and public entries: their creator or the Chairman.
-- Team entries: anyone who manages the team.
create policy "Board edits entries" on public.calendar_entries for update to authenticated
  using ((visibility = 'team' and private.can_manage_team(team_id))
         or (visibility <> 'team' and (created_by = (select auth.uid()) or (select private.is_chairman()))))
  with check (private.can_write_calendar(visibility, team_id));
create policy "Board deletes entries" on public.calendar_entries for delete to authenticated
  using ((visibility = 'team' and private.can_manage_team(team_id))
         or (visibility <> 'team' and (created_by = (select auth.uid()) or (select private.is_chairman()))));
revoke update on public.calendar_entries from anon, authenticated;
grant update (team_id, visibility, title, description, starts_at, ends_at, all_day, location,
              online_url, linked_type, linked_id, reminder_minutes) on public.calendar_entries to authenticated;

-- One feed for the calendar screen (FR-15.1, FR-15.7): manual entries,
-- events and task deadlines, filtered to what this person may see.
-- p_uid is null for guests: they get public entries and listed events.
create function private.calendar_feed_for(
  p_uid uuid, p_from timestamptz, p_to timestamptz, p_team uuid default null
)
returns table (
  source text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean,
  location text, online_url text, team_id uuid, visibility public.calendar_visibility,
  linked_type text, linked_id uuid
)
language sql stable security definer set search_path = '' as $$
  select 'entry', c.id, c.title, c.starts_at, c.ends_at, c.all_day, c.location, c.online_url,
         c.team_id, c.visibility, c.linked_type, c.linked_id
  from public.calendar_entries c
  where c.starts_at < p_to and coalesce(c.ends_at, c.starts_at) >= p_from
    and (p_team is null or c.team_id = p_team)
    and (c.visibility = 'public' or (p_uid is not null and private.can_see_calendar_entry(c.visibility, c.team_id, p_uid)))

  union all

  select 'event', e.id, e.title, e.starts_at, e.ends_at, false, e.venue, null,
         null, case when private.event_is_listed(e) then 'public' else 'club' end::public.calendar_visibility,
         'event', e.id
  from public.events e
  where e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
    and p_team is null
    and e.status <> 'cancelled'
    and (private.event_is_listed(e)
         or (p_uid is not null and private.is_member(p_uid) and e.status <> 'draft'))

  union all

  select 'task_deadline', t.id, 'Due: ' || t.title, t.deadline, null, false, null, null,
         t.team_id, 'team'::public.calendar_visibility, 'task', t.id
  from public.tasks t
  where p_uid is not null
    and t.deadline >= p_from and t.deadline < p_to
    and t.status not in ('done', 'declined')
    and (p_team is null or t.team_id = p_team)
    and private.can_see_task(t.id, p_uid)

  order by 4
$$;

create function public.calendar_feed(p_from timestamptz, p_to timestamptz, p_team uuid default null)
returns table (
  source text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean,
  location text, online_url text, team_id uuid, visibility public.calendar_visibility,
  linked_type text, linked_id uuid
)
language sql stable security definer set search_path = '' as $$
  select * from private.calendar_feed_for(auth.uid(), p_from, least(p_to, p_from + interval '400 days'), p_team)
$$;

-- Personal .ics feed (FR-15.9). Each member gets a secret link; only its
-- hash is stored. Rotating the token breaks the old link.
create table public.calendar_feed_tokens (
  user_id    uuid primary key references public.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.calendar_feed_tokens enable row level security;
revoke all on public.calendar_feed_tokens from anon, authenticated;

create function public.rotate_calendar_feed_token() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := private.new_token();
begin
  if not private.is_member() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.calendar_feed_tokens (user_id, token_hash)
  values (auth.uid(), private.hash_token(v_token))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return v_token;
end $$;

-- Used by the calendar-ics server function (service role only).
create function public.calendar_feed_for_token(p_token text, p_from timestamptz, p_to timestamptz)
returns table (
  source text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean,
  location text, online_url text, team_id uuid, visibility public.calendar_visibility,
  linked_type text, linked_id uuid
)
language sql stable security definer set search_path = '' as $$
  select f.* from public.calendar_feed_tokens t,
    lateral private.calendar_feed_for(t.user_id, p_from, p_to) f
  where t.token_hash = private.hash_token(p_token)
    and private.is_member(t.user_id)
$$;

revoke execute on function public.calendar_feed_for_token(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.calendar_feed_for_token(text, timestamptz, timestamptz) to service_role;
revoke execute on function public.rotate_calendar_feed_token() from public, anon;
