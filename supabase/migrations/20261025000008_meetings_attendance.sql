-- =====================================================================
-- 0008 · Meetings, attendance, excuses, absence levels
-- Requirements: FR-7.1–FR-7.8, FR-15.7 (meetings on the calendar)
--
-- Scope of a meeting: one team, one division, or the whole club.
-- Who is expected:
--   board meetings → Executives and Curators in scope
--   everything else → Associates in scope
-- Who marks someone: an Associate → their team's Executives (48 h to
-- correct), their Curator, the Chairman · an Executive → their Curator,
-- the Chairman · a Curator → the Chairman.
-- =====================================================================

create type public.meeting_type as enum ('team_meeting', 'board_meeting', 'workshop', 'general_assembly', 'event', 'session');
create type public.attendance_status as enum ('attended', 'absent', 'late', 'excused');

create table public.meetings (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) default private.active_season_id(),
  type        public.meeting_type not null,
  title       text not null check (length(trim(title)) > 0),
  team_id     uuid references public.teams (id),
  division_id uuid references public.divisions (id),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  slot        text,
  location    text,
  online_url  text,
  agenda      text,
  minutes     text,
  qr_secret   text not null default private.new_token(),
  created_by  uuid references public.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (team_id is null or division_id is null),
  check (ends_at is null or ends_at >= starts_at)
);
create index meetings_season_idx on public.meetings (season_id, starts_at);
create trigger meetings_touch before update on public.meetings
  for each row execute function private.touch_updated_at();

create table public.attendance (
  meeting_id      uuid not null references public.meetings (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  status          public.attendance_status not null,
  via             text not null default 'manual' check (via in ('manual', 'qr', 'excuse')),
  note            text,
  marked_by       uuid references public.users (id),
  marked_at       timestamptz not null default now(),
  first_marked_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
create index attendance_user_idx on public.attendance (user_id);
create trigger attendance_audit after insert or update or delete on public.attendance
  for each row execute function private.audit();

create table public.excuses (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.meetings (id) on delete cascade,
  user_id         uuid not null default auth.uid() references public.users (id) on delete cascade,
  note            text not null check (length(trim(note)) > 0),
  attachment_path text,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by      uuid references public.users (id),
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (meeting_id, user_id)
);

-- Thresholds already announced to a member this season (FR-7.6).
create table public.absence_notices (
  user_id     uuid not null references public.users (id) on delete cascade,
  season_id   uuid not null references public.seasons (id),
  level       int not null,
  notified_at timestamptz not null default now(),
  primary key (user_id, season_id, level)
);

-- Action items from minutes become tasks (FR-7.2).
alter table public.tasks add column meeting_id uuid references public.meetings (id) on delete set null;
grant update (meeting_id) on public.tasks to authenticated;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create function private.can_see_meeting(
  p_type public.meeting_type, p_team uuid, p_division uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_type = 'board_meeting' then private.my_role(p_uid) in ('chairman', 'curator', 'executive')
         and (p_division is null or private.can_manage_division(p_division, p_uid)
              or exists (select 1 from private.membership_of(p_uid) m where m.division_id = p_division))
    when p_team is not null then private.can_see_team(p_team, p_uid)
    when p_division is not null then private.can_manage_division(p_division, p_uid)
         or exists (select 1 from private.membership_of(p_uid) m where m.division_id = p_division)
    else private.is_member(p_uid)
  end
$$;

create function private.can_write_meeting(
  p_type public.meeting_type, p_team uuid, p_division uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_team is not null then private.can_manage_team(p_team, p_uid)
    when p_division is not null then private.can_manage_division(p_division, p_uid)
    when p_type = 'board_meeting' then private.is_chairman(p_uid)
    -- Club-wide workshops and assemblies: Chairman, Curators, OD Executives.
    else exists (select 1 from private.membership_of(p_uid) m
                 where m.role in ('chairman', 'curator')
                    or (m.role = 'executive' and m.division_kind = 'org_development'))
  end
$$;

-- Everyone expected at a meeting.
create function private.meeting_expected(p_meeting uuid)
returns table (user_id uuid, role public.member_role, team_id uuid, division_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, m.team_id, m.division_id
  from public.meetings mt
  join public.memberships m on m.season_id = mt.season_id and m.status = 'active'
  where mt.id = p_meeting
    and case when mt.type = 'board_meeting' then m.role in ('executive', 'curator')
             else m.role = 'associate' end
    and (mt.team_id is null or m.team_id = mt.team_id)
    and (mt.division_id is null or m.division_id = mt.division_id)
$$;

create function private.is_expected(p_meeting uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.meeting_expected(p_meeting) e where e.user_id = p_user)
$$;

-- May p_uid mark attendance for p_target?
create function private.can_mark(p_target uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.seasons s on s.id = m.season_id and s.is_active
    where m.user_id = p_target and m.status = 'active'
      and ((m.role = 'associate' and private.can_manage_team(m.team_id, p_uid))
        or (m.role = 'executive' and private.can_manage_division(m.division_id, p_uid))
        or (m.role = 'curator' and private.is_chairman(p_uid))))
$$;

-- Rotating 30-second code shown as a QR at the meeting (FR-7.4).
create function private.meeting_code(p_secret text, p_window bigint) returns text
language sql immutable set search_path = '' as $$
  select left(encode(sha256(convert_to(p_secret || ':' || p_window::text, 'UTF8')), 'hex'), 10)
$$;

-- Level = unexcused absences + every N lates (FR-7.6).
create function private.absence_level(p_user uuid, p_type public.meeting_type default null) returns int
language sql stable security definer set search_path = '' as $$
  with s as (
    select count(*) filter (where a.status = 'absent') as absent,
           count(*) filter (where a.status = 'late') as late
    from public.attendance a
    join public.meetings mt on mt.id = a.meeting_id
    where a.user_id = p_user and mt.season_id = private.active_season_id()
      and (p_type is null or mt.type = p_type)
  ), n as (
    select greatest(coalesce((private.setting('lates_per_absence', '2'))::text::int, 2), 0) as per
  )
  select (s.absent + case when n.per > 0 then s.late / n.per else 0 end)::int from s, n
$$;

-- Tell people when a member crosses a threshold, once per threshold.
create function private.check_absence_level(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_level int := private.absence_level(p_user);
  v_rule jsonb;
  v_member record;
  v_name text;
begin
  select * into v_member from private.membership_of(p_user);
  select name into v_name from public.users where id = p_user;
  for v_rule in
    select r from jsonb_array_elements(private.setting('absence_levels', '[]')) r
    where (r ->> 'level')::int <= v_level
    order by (r ->> 'level')::int
  loop
    insert into public.absence_notices (user_id, season_id, level)
    values (p_user, private.active_season_id(), (v_rule ->> 'level')::int)
    on conflict do nothing;
    if found then
      if v_rule ->> 'action' = 'warn_member' then
        perform private.notify(array[p_user], 'absence_warning',
          'Absence level ' || (v_rule ->> 'level') || ': please check your attendance', null, '/portal/attendance');
      elsif v_rule ->> 'action' = 'notify_curator' then
        perform private.notify(
          array(select m.user_id from public.memberships m
                where m.status = 'active' and m.season_id = v_member.season_id
                  and ((m.role = 'curator' and m.division_id = v_member.division_id)
                    or (m.role = 'executive' and m.team_id = v_member.team_id))),
          'absence_level', v_name || ' reached absence level ' || (v_rule ->> 'level'), null,
          '/portal/attendance/member/' || p_user);
      end if;
    end if;
  end loop;
end $$;

-- Tell the expected members about a new meeting.
create function private.meetings_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(
    array(select e.user_id from private.meeting_expected(new.id) e),
    'meeting_scheduled', 'New ' || replace(new.type::text, '_', ' ') || ': ' || new.title, null,
    '/portal/meetings/' || new.id);
  return null;
end $$;
create trigger meetings_notify after insert on public.meetings
  for each row execute function private.meetings_notify();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;
alter table public.excuses enable row level security;
alter table public.absence_notices enable row level security;

create policy "Members read meetings in scope" on public.meetings for select to authenticated
  using (private.can_see_meeting(type, team_id, division_id) or (select private.is_chairman()));
create policy "Organisers create meetings" on public.meetings for insert to authenticated
  with check (season_id = (select private.active_season_id())
              and private.can_write_meeting(type, team_id, division_id));
create policy "Organisers edit meetings" on public.meetings for update to authenticated
  using (private.can_write_meeting(type, team_id, division_id))
  with check (private.can_write_meeting(type, team_id, division_id));
create policy "Organisers delete meetings" on public.meetings for delete to authenticated
  using (private.can_write_meeting(type, team_id, division_id));
-- The QR secret never leaves the database.
revoke select, update on public.meetings from anon, authenticated;
grant select (id, season_id, type, title, team_id, division_id, starts_at, ends_at, slot, location,
              online_url, agenda, minutes, created_by, created_at, updated_at) on public.meetings to authenticated;
grant update (type, title, starts_at, ends_at, slot, location, online_url, agenda, minutes) on public.meetings to authenticated;

create policy "Own attendance; markers see theirs" on public.attendance for select to authenticated
  using (user_id = (select auth.uid()) or private.can_mark(user_id));
revoke insert, update, delete on public.attendance from anon, authenticated;

create policy "Own excuses; markers see theirs" on public.excuses for select to authenticated
  using (user_id = (select auth.uid()) or private.can_mark(user_id));
create policy "Send an excuse in time" on public.excuses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.is_expected(meeting_id, (select auth.uid()))
    and exists (select 1 from public.meetings mt
                where mt.id = meeting_id
                  and now() <= mt.starts_at + make_interval(
                        hours => coalesce((private.setting('excuse_window_hours', '48'))::text::int, 48))));
revoke update, delete on public.excuses from anon, authenticated;

create policy "Own notices" on public.absence_notices for select to authenticated
  using (user_id = (select auth.uid()) or private.can_mark(user_id));
revoke insert, update, delete on public.absence_notices from anon, authenticated;

revoke all on public.meetings, public.attendance, public.excuses, public.absence_notices from anon;

-- ---------------------------------------------------------------------
-- Taking attendance (FR-7.4)
-- ---------------------------------------------------------------------

-- The roll-call list: everyone this person may mark at this meeting.
create function public.meeting_roll_call(p_meeting_id uuid)
returns table (user_id uuid, name text, photo_url text, team text, status public.attendance_status,
               via text, note text, can_edit boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_window int := coalesce((private.setting('attendance_edit_window_hours', '48'))::text::int, 48);
  v_exec boolean := private.my_role() = 'executive';
begin
  return query
    select e.user_id, u.name, u.photo_url, t.name, a.status, a.via, a.note,
           (a.first_marked_at is null or not v_exec or now() <= a.first_marked_at + make_interval(hours => v_window))
    from private.meeting_expected(p_meeting_id) e
    join public.users u on u.id = e.user_id
    left join public.teams t on t.id = e.team_id
    left join public.attendance a on a.meeting_id = p_meeting_id and a.user_id = e.user_id
    where private.can_mark(e.user_id)
    order by t.name, u.name;
end $$;

-- Save marks: [{"user_id": "...", "status": "attended", "note": "..."}].
-- "Mark all present" is the app sending everyone as attended.
create function public.submit_attendance(p_meeting_id uuid, p_marks jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_window int := coalesce((private.setting('attendance_edit_window_hours', '48'))::text::int, 48);
  v_exec boolean := private.my_role() = 'executive';
  v_mark record;
  v_existing public.attendance;
  v_count int := 0;
begin
  if not exists (select 1 from public.meetings where id = p_meeting_id) then
    raise exception 'not_found';
  end if;
  for v_mark in
    select (m ->> 'user_id')::uuid as user_id, (m ->> 'status')::public.attendance_status as status,
           nullif(trim(m ->> 'note'), '') as note
    from jsonb_array_elements(p_marks) m
  loop
    if not private.is_expected(p_meeting_id, v_mark.user_id) then
      raise exception 'not_expected';
    end if;
    if not private.can_mark(v_mark.user_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    select * into v_existing from public.attendance where meeting_id = p_meeting_id and user_id = v_mark.user_id;
    if found and v_exec and now() > v_existing.first_marked_at + make_interval(hours => v_window) then
      raise exception 'edit_window_closed';
    end if;
    insert into public.attendance (meeting_id, user_id, status, via, note, marked_by)
    values (p_meeting_id, v_mark.user_id, v_mark.status, 'manual', v_mark.note, auth.uid())
    on conflict (meeting_id, user_id) do update
      set status = excluded.status, via = 'manual', note = excluded.note,
          marked_by = excluded.marked_by, marked_at = now();
    perform private.check_absence_level(v_mark.user_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Current meeting QR code for organisers and markers.
create function public.meeting_qr(p_meeting_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mt public.meetings;
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
begin
  select * into v_mt from public.meetings where id = p_meeting_id;
  if not found or not (private.can_write_meeting(v_mt.type, v_mt.team_id, v_mt.division_id)
                       or exists (select 1 from private.meeting_expected(p_meeting_id) e where private.can_mark(e.user_id))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'meeting_id', v_mt.id,
    'code', private.meeting_code(v_mt.qr_secret, v_epoch / 30),
    'valid_for_seconds', 30 - (v_epoch % 30));
end $$;

-- An expected member scans the meeting QR (FR-7.4). Late after 15 min.
-- A manual mark already made is never overwritten.
create function public.meeting_check_in(p_meeting_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_mt public.meetings;
  v_window bigint := floor(extract(epoch from now()))::bigint / 30;
  v_status public.attendance_status;
  v_existing public.attendance;
begin
  select * into v_mt from public.meetings where id = p_meeting_id;
  if not found or not private.is_expected(p_meeting_id, auth.uid()) then
    raise exception 'not_expected';
  end if;
  if now() < v_mt.starts_at - interval '30 minutes'
     or now() > coalesce(v_mt.ends_at, v_mt.starts_at + interval '3 hours') then
    raise exception 'check_in_closed';
  end if;
  if lower(trim(coalesce(p_code, ''))) not in (private.meeting_code(v_mt.qr_secret, v_window),
                                               private.meeting_code(v_mt.qr_secret, v_window - 1)) then
    raise exception 'invalid_code';
  end if;

  select * into v_existing from public.attendance where meeting_id = p_meeting_id and user_id = auth.uid();
  if found then
    return jsonb_build_object('result', 'already_marked', 'status', v_existing.status);
  end if;
  v_status := case when now() > v_mt.starts_at + interval '15 minutes' then 'late' else 'attended' end;
  insert into public.attendance (meeting_id, user_id, status, via, marked_by)
  values (p_meeting_id, auth.uid(), v_status, 'qr', auth.uid());
  perform private.check_absence_level(auth.uid());
  return jsonb_build_object('result', 'ok', 'status', v_status);
end $$;

-- Accept or reject an excuse (FR-7.7). Accepting marks the session excused.
create function public.decide_excuse(p_excuse_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ex public.excuses;
  v_title text;
begin
  select * into v_ex from public.excuses where id = p_excuse_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_mark(v_ex.user_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_ex.status <> 'pending' then raise exception 'already_decided'; end if;

  update public.excuses
     set status = case when p_accept then 'accepted' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_excuse_id;
  if p_accept then
    insert into public.attendance (meeting_id, user_id, status, via, note, marked_by)
    values (v_ex.meeting_id, v_ex.user_id, 'excused', 'excuse', v_ex.note, auth.uid())
    on conflict (meeting_id, user_id) do update
      set status = 'excused', via = 'excuse', note = excluded.note, marked_by = excluded.marked_by, marked_at = now();
  end if;
  select title into v_title from public.meetings where id = v_ex.meeting_id;
  perform private.notify(array[v_ex.user_id], 'excuse_' || case when p_accept then 'accepted' else 'rejected' end,
    'Excuse ' || case when p_accept then 'accepted' else 'rejected' end || ': ' || v_title, null, '/portal/attendance');
  perform private.check_absence_level(v_ex.user_id);
end $$;

-- ---------------------------------------------------------------------
-- Views of attendance (FR-7.3, FR-7.5, FR-7.8)
-- ---------------------------------------------------------------------

-- "My attendance": every marked session, newest first, numbered.
create function public.my_attendance(p_type public.meeting_type default null)
returns table (n bigint, meeting_id uuid, title text, type public.meeting_type, starts_at timestamptz,
               slot text, status public.attendance_status, note text)
language sql stable security definer set search_path = '' as $$
  select * from (
    select row_number() over (order by mt.starts_at), mt.id, mt.title, mt.type, mt.starts_at, mt.slot, a.status, a.note
    from public.attendance a
    join public.meetings mt on mt.id = a.meeting_id
    where a.user_id = auth.uid() and mt.season_id = private.active_season_id()
      and (p_type is null or mt.type = p_type)
  ) s
  order by 5 desc
$$;

-- Summary by meeting type with levels, for the member or their markers.
create function public.attendance_summary(p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
begin
  if v_user <> auth.uid() and not private.can_mark(v_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'overall_level', private.absence_level(v_user),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', x.type, 'attended', x.attended, 'late', x.late, 'absent', x.absent, 'excused', x.excused,
        'level', private.absence_level(v_user, x.type)) order by x.type)
      from (
        select mt.type,
               count(*) filter (where a.status = 'attended') as attended,
               count(*) filter (where a.status = 'late') as late,
               count(*) filter (where a.status = 'absent') as absent,
               count(*) filter (where a.status = 'excused') as excused
        from public.attendance a join public.meetings mt on mt.id = a.meeting_id
        where a.user_id = v_user and mt.season_id = private.active_season_id()
        group by mt.type) x), '[]'::jsonb));
end $$;

-- Rate per member, for Executives (own team), Curators (division) and
-- the Chairman (everyone). Rate = (attended + late) / (sessions − excused).
-- Feeds evaluations (FR-7.8).
create function public.attendance_rates(p_team uuid default null, p_division uuid default null)
returns table (user_id uuid, name text, team text, sessions bigint, attended bigint, late bigint,
               absent bigint, excused bigint, rate numeric, level int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((p_team is not null and private.can_manage_team(p_team))
       or (p_team is null and p_division is not null and private.can_manage_division(p_division))
       or (p_team is null and p_division is null and private.is_chairman())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.name, t.name,
           count(a.*), count(*) filter (where a.status = 'attended'), count(*) filter (where a.status = 'late'),
           count(*) filter (where a.status = 'absent'), count(*) filter (where a.status = 'excused'),
           round(100.0 * count(*) filter (where a.status in ('attended', 'late'))
                 / nullif(count(a.*) - count(*) filter (where a.status = 'excused'), 0), 1),
           private.absence_level(m.user_id)
    from public.memberships m
    join public.seasons s on s.id = m.season_id and s.is_active
    join public.users u on u.id = m.user_id
    left join public.teams t on t.id = m.team_id
    left join public.attendance a on a.user_id = m.user_id
      and exists (select 1 from public.meetings mt where mt.id = a.meeting_id and mt.season_id = s.id)
    where m.status = 'active' and m.role in ('associate', 'executive')
      and (p_team is null or m.team_id = p_team)
      and (p_division is null or m.division_id = p_division)
    group by m.user_id, u.name, t.name
    order by t.name, u.name;
end $$;

-- Rate per meeting for the same audiences (FR-7.5).
create function public.meeting_attendance_rates(p_team uuid default null, p_division uuid default null)
returns table (meeting_id uuid, title text, type public.meeting_type, starts_at timestamptz,
               marked bigint, present bigint, rate numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((p_team is not null and private.can_manage_team(p_team))
       or (p_team is null and p_division is not null and private.can_manage_division(p_division))
       or (p_team is null and p_division is null and private.is_chairman())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select mt.id, mt.title, mt.type, mt.starts_at,
           count(a.*), count(*) filter (where a.status in ('attended', 'late')),
           round(100.0 * count(*) filter (where a.status in ('attended', 'late'))
                 / nullif(count(a.*) - count(*) filter (where a.status = 'excused'), 0), 1)
    from public.meetings mt
    left join public.attendance a on a.meeting_id = mt.id
    where mt.season_id = private.active_season_id()
      and (p_team is null or mt.team_id = p_team)
      and (p_division is null or mt.division_id = p_division
           or mt.team_id in (select id from public.teams where division_id = p_division))
    group by mt.id
    order by mt.starts_at desc;
end $$;

revoke execute on function public.meeting_roll_call(uuid) from public, anon;
revoke execute on function public.submit_attendance(uuid, jsonb) from public, anon;
revoke execute on function public.meeting_qr(uuid) from public, anon;
revoke execute on function public.meeting_check_in(uuid, text) from public, anon;
revoke execute on function public.decide_excuse(uuid, boolean) from public, anon;
revoke execute on function public.my_attendance(public.meeting_type) from public, anon;
revoke execute on function public.attendance_summary(uuid) from public, anon;
revoke execute on function public.attendance_rates(uuid, uuid) from public, anon;
revoke execute on function public.meeting_attendance_rates(uuid, uuid) from public, anon;

-- Excuse attachments: private bucket, <user id>/<file>.
insert into storage.buckets (id, name, public) values ('excuses', 'excuses', false)
on conflict (id) do nothing;
create policy "Upload own excuse files" on storage.objects for insert to authenticated
  with check (bucket_id = 'excuses' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own excuse files; markers read theirs" on storage.objects for select to authenticated
  using (bucket_id = 'excuses'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or private.can_mark(private.try_uuid((storage.foldername(name))[1]))));

-- ---------------------------------------------------------------------
-- Meetings on the calendar (FR-15.7): same feed as 0005, plus meetings.
-- ---------------------------------------------------------------------
create or replace function private.calendar_feed_for(
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

  select 'meeting', mt.id, mt.title, mt.starts_at, mt.ends_at, false, mt.location, mt.online_url,
         mt.team_id, case when mt.team_id is null then 'club' else 'team' end::public.calendar_visibility,
         'meeting', mt.id
  from public.meetings mt
  where p_uid is not null
    and mt.starts_at < p_to and coalesce(mt.ends_at, mt.starts_at) >= p_from
    and (p_team is null or mt.team_id = p_team)
    and (private.can_see_meeting(mt.type, mt.team_id, mt.division_id, p_uid) or private.is_chairman(p_uid))

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
