-- Team assignments belong to the existing season membership. They never
-- change a person's club role or delete their club membership/account.
create table public.team_memberships (
  id uuid not null unique default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (membership_id, team_id)
);
create index team_memberships_team_idx on public.team_memberships(team_id);

-- A member without a team is still an active club member with the same role.
-- Keep their division so its Curator can assign them again.
alter table public.memberships drop constraint memberships_shape;
alter table public.memberships add constraint memberships_shape check (
     (role = 'chairman' and division_id is null and team_id is null)
  or (role = 'curator' and division_id is not null and team_id is null)
  or (role in ('executive', 'associate') and division_id is not null)
);

create function private.validate_team_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member_season uuid; v_team_season uuid;
begin
  select season_id into v_member_season from public.memberships where id = new.membership_id;
  select season_id into v_team_season from public.teams where id = new.team_id;
  if v_member_season is distinct from v_team_season then raise exception 'team_or_division_in_other_season'; end if;
  return new;
end $$;
create trigger team_memberships_validate before insert or update on public.team_memberships
  for each row execute function private.validate_team_membership();
create trigger team_memberships_audit after insert or update or delete on public.team_memberships
  for each row execute function private.audit();

insert into public.team_memberships(membership_id, team_id)
  select id, team_id from public.memberships where team_id is not null;

-- Invitations, Chairman role changes and season preparation keep working
-- through the original membership mechanism; synchronize their primary team.
create function private.sync_primary_team_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.team_id is distinct from new.team_id and old.team_id is not null then
    delete from public.team_memberships where membership_id = new.id and team_id = old.team_id;
  end if;
  if new.team_id is not null then
    insert into public.team_memberships(membership_id, team_id) values (new.id, new.team_id) on conflict (membership_id, team_id) do nothing;
  end if;
  return null;
end $$;
create trigger memberships_sync_teams after insert or update of team_id on public.memberships
  for each row execute function private.sync_primary_team_membership();

alter table public.team_memberships enable row level security;
revoke all on public.team_memberships from anon, authenticated;
grant select on public.team_memberships to authenticated;
create policy "Club directory includes team assignments" on public.team_memberships for select to authenticated
  using ((select private.has_any_membership()));

create view public.team_roster with (security_invoker = true) as
  select tm.id, tm.membership_id, m.user_id, tm.team_id, m.role, m.season_id, m.status
  from public.team_memberships tm join public.memberships m on m.id = tm.membership_id;
grant select on public.team_roster to authenticated;
revoke all on public.team_roster from anon;

create function private.has_team_membership(p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_memberships tm
    join public.memberships m on m.id = tm.membership_id
    join public.seasons s on s.id = m.season_id and s.is_active
    where tm.team_id = p_team and m.user_id = p_uid and m.status = 'active'
  )
$$;

-- Attendance follows actual team assignments, with authority checked against
-- the meeting's team so a shared member cannot expose another team's records.
create or replace function private.meeting_expected(p_meeting uuid)
returns table (user_id uuid, role public.member_role, team_id uuid, division_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, coalesce(mt.team_id, m.team_id), coalesce(t.division_id, m.division_id)
  from public.meetings mt
  join public.memberships m on m.season_id = mt.season_id and m.status = 'active'
  left join public.teams t on t.id = mt.team_id
  where mt.id = p_meeting
    and case when mt.type = 'board_meeting' then m.role in ('executive', 'curator') else m.role = 'associate' end
    and (mt.team_id is null or exists (
      select 1 from public.team_memberships tm where tm.membership_id = m.id and tm.team_id = mt.team_id))
    and (mt.division_id is null or coalesce(t.division_id, m.division_id) = mt.division_id)
$$;

-- Secondary membership grants ordinary team access, never a promotion or
-- Executive management of another team. Primary leadership stays unchanged.
create or replace function private.can_see_team(p_team uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_team(p_team, p_uid) or private.has_team_membership(p_team, p_uid)
$$;

create function private.can_manage_team_member(p_team uuid, p_target uuid, p_add boolean, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) actor
    join public.teams t on t.id = p_team and t.season_id = actor.season_id
    join public.memberships subject on subject.user_id = p_target and subject.season_id = actor.season_id and subject.status = 'active'
    where actor.role = 'chairman'
       or (actor.role = 'curator' and t.division_id = actor.division_id
           and subject.role in ('executive', 'associate')
           and (subject.division_id = actor.division_id or exists (
             select 1 from public.team_memberships tm join public.teams st on st.id = tm.team_id
             where tm.membership_id = subject.id and st.division_id = actor.division_id)))
       or (actor.role = 'executive' and actor.team_id = p_team and subject.role = 'associate'
           and (case when p_add then subject.team_id is null and subject.division_id = t.division_id
                     and not exists(select 1 from public.team_memberships tm where tm.membership_id = subject.id)
                else private.has_team_membership(p_team, p_target) end))
  )
$$;

create function public.add_team_member(p_team_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_member public.memberships;
begin
  -- Prevent role/scope changes while checking and applying the operation.
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  perform 1 from public.teams where id = p_team_id and season_id = private.active_season_id() for share;
  select * into v_member from public.memberships where user_id = p_user_id and season_id = private.active_season_id() and status = 'active' for update;
  if not private.can_manage_team_member(p_team_id, p_user_id, true) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if exists(select 1 from public.team_memberships where membership_id = v_member.id and team_id = p_team_id) then raise exception 'already_in_team'; end if;
  insert into public.team_memberships(membership_id, team_id) values (v_member.id, p_team_id);
  if v_member.role in ('executive', 'associate') and v_member.team_id is null then
    update public.memberships set team_id = p_team_id where id = v_member.id;
  end if;
end $$;

create function public.remove_team_member(p_team_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_member public.memberships;
begin
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  perform 1 from public.teams where id = p_team_id and season_id = private.active_season_id() for share;
  select * into v_member from public.memberships where user_id = p_user_id and season_id = private.active_season_id() and status = 'active' for update;
  if not private.can_manage_team_member(p_team_id, p_user_id, false) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.team_memberships where membership_id = v_member.id and team_id = p_team_id;
  if not found then raise exception 'not_in_team'; end if;
  if v_member.team_id = p_team_id then
    -- Do not silently promote an Executive to leadership of a secondary team.
    update public.memberships set team_id = null where id = v_member.id;
  end if;
end $$;

revoke all on function public.add_team_member(uuid, uuid), public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.add_team_member(uuid, uuid), public.remove_team_member(uuid, uuid) to authenticated;

-- New team members can receive that team's tasks and announcements.
create or replace function private.task_assignees_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if not private.has_team_membership(v_task.team_id, new.user_id) then raise exception 'assignee_not_in_team'; end if;
  perform private.notify(array[new.user_id], 'task_assigned', 'New task: ' || v_task.title, null, '/portal/tasks/' || v_task.id);
  return new;
end $$;

create or replace function private.in_audience(
  p_type public.audience_type, p_division uuid, p_team uuid, p_role public.member_role, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where p_type = 'all'
       or (p_type = 'division' and m.division_id = p_division)
       or (p_type = 'team' and (private.has_team_membership(p_team, p_uid)
             or (m.role = 'curator' and m.division_id = private.team_division(p_team))))
       or (p_type = 'role' and m.role = p_role)
  )
$$;

create function private.can_mark_at_meeting(p_meeting uuid, p_target uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetings mt
    join private.meeting_expected(p_meeting) e on e.user_id = p_target
    where mt.id = p_meeting and (
      (mt.team_id is null and private.can_mark(p_target, p_uid))
      or (mt.team_id is not null and (
        (e.role = 'associate' and private.can_manage_team(mt.team_id, p_uid))
        or (e.role = 'executive' and private.can_manage_division(private.team_division(mt.team_id), p_uid))
        or (e.role = 'curator' and private.is_chairman(p_uid))
      ))
    )
  )
$$;

alter policy "Own attendance; markers see theirs" on public.attendance
  using (user_id = (select auth.uid()) or private.can_mark_at_meeting(meeting_id, user_id));
alter policy "Own excuses; markers see theirs" on public.excuses
  using (user_id = (select auth.uid()) or private.can_mark_at_meeting(meeting_id, user_id));

create or replace function public.meeting_roll_call(p_meeting_id uuid)
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
    where private.can_mark_at_meeting(p_meeting_id, e.user_id)
    order by t.name, u.name;
end $$;

create or replace function public.submit_attendance(p_meeting_id uuid, p_marks jsonb) returns int
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
    if not private.can_mark_at_meeting(p_meeting_id, v_mark.user_id) then
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

create or replace function public.meeting_qr(p_meeting_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mt public.meetings;
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
begin
  select * into v_mt from public.meetings where id = p_meeting_id;
  if not found or not (private.can_write_meeting(v_mt.type, v_mt.team_id, v_mt.division_id)
                       or exists (select 1 from private.meeting_expected(p_meeting_id) e where private.can_mark_at_meeting(p_meeting_id, e.user_id))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'meeting_id', v_mt.id,
    'code', private.meeting_code(v_mt.qr_secret, v_epoch / 30),
    'valid_for_seconds', 30 - (v_epoch % 30));
end $$;

create or replace function public.decide_excuse(p_excuse_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ex public.excuses;
  v_title text;
begin
  select * into v_ex from public.excuses where id = p_excuse_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.can_mark_at_meeting(v_ex.meeting_id, v_ex.user_id) then
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
