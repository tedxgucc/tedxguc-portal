-- =====================================================================
-- 0004 · Tasks: assignees, comments with @mentions, attachments,
--        cross-team requests, reminders and overdue flags.
-- Requirements: FR-6.1–FR-6.5
--
-- Who can do what:
--   Managers of the task's team (Chairman, the division's Curator, the
--   team's Executives): everything.
--   Assignees: see the task, comment, move it between To do / In progress
--   / In review. Only the creator or a manager can mark it Done (FR-6.2).
--   Requesting team (FR-6.5): its managers create the request and follow it.
-- =====================================================================

create type public.task_status as enum ('requested', 'todo', 'in_progress', 'in_review', 'done', 'declined');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.teams (id),
  title                text not null check (length(trim(title)) > 0),
  description          text,
  created_by           uuid not null default auth.uid() references public.users (id),
  deadline             timestamptz,
  priority             public.task_priority not null default 'normal',
  status               public.task_status not null default 'todo',
  requested_by_team_id uuid references public.teams (id),
  decline_reason       text,
  completed_at         timestamptz,
  reminder_sent_at     timestamptz,
  overdue_notified_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (requested_by_team_id is null or requested_by_team_id <> team_id)
);
create index tasks_team_idx on public.tasks (team_id, status);
create index tasks_deadline_idx on public.tasks (deadline) where status not in ('done', 'declined');
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();

create table public.task_assignees (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.users (id),
  body       text not null check (length(trim(body)) > 0),
  mentions   uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);
create trigger task_comments_touch before update on public.task_comments
  for each row execute function private.touch_updated_at();

-- Files are stored in the private "task-files" bucket at
-- <task_id>/<file name>; this table lists them.
create table public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  name         text not null,
  storage_path text not null,
  uploaded_by  uuid not null default auth.uid() references public.users (id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create function private.task_team(p_task uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.tasks where id = p_task
$$;

create function private.is_task_assignee(p_task uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_assignees where task_id = p_task and user_id = p_uid)
$$;

create function private.can_manage_task(p_task uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_team(private.task_team(p_task), p_uid)
$$;

create function private.can_see_task(p_task uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task
      and private.is_member(p_uid)
      and (private.can_manage_team(t.team_id, p_uid)
           or t.created_by = p_uid
           or (t.requested_by_team_id is not null and private.can_manage_team(t.requested_by_team_id, p_uid))
           or private.is_task_assignee(t.id, p_uid)))
$$;

-- ---------------------------------------------------------------------
-- Rules that RLS alone can't express
-- ---------------------------------------------------------------------

-- New tasks: the team must be in the current season. Cross-team requests
-- start as "requested" and normal tasks can't.
create function private.tasks_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.teams where id = new.team_id and season_id = private.active_season_id()) then
    raise exception 'team_not_in_active_season';
  end if;
  if new.requested_by_team_id is not null then
    new.status := 'requested';
  elsif new.status = 'requested' then
    new.status := 'todo';
  end if;
  if new.status = 'done' then
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger tasks_before_insert before insert on public.tasks
  for each row execute function private.tasks_before_insert();

-- Updates: assignees and requesters can only move status, and only
-- along the allowed steps.
create function private.tasks_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_manager boolean;
begin
  if v_uid is null then
    return new;  -- service role / scheduled jobs
  end if;
  v_manager := private.can_manage_team(old.team_id, v_uid);

  if not v_manager then
    if (new.team_id, new.title, new.description, new.deadline, new.priority,
        new.requested_by_team_id, new.created_by)
       is distinct from
       (old.team_id, old.title, old.description, old.deadline, old.priority,
        old.requested_by_team_id, old.created_by) then
      raise exception 'only_managers_edit_task_details' using errcode = '42501';
    end if;
    if old.status = 'requested' or new.status in ('requested', 'declined') then
      raise exception 'only_receiving_team_accepts_requests' using errcode = '42501';
    end if;
    if new.status = 'done' and old.status <> 'done' and old.created_by <> v_uid then
      raise exception 'only_creator_or_executive_marks_done' using errcode = '42501';
    end if;
  else
    if new.team_id <> old.team_id and not private.can_manage_team(new.team_id, v_uid) then
      raise exception 'cannot_move_task_to_that_team' using errcode = '42501';
    end if;
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if new.deadline is distinct from old.deadline then
    new.reminder_sent_at := null;
    new.overdue_notified_at := null;
  end if;
  return new;
end $$;
create trigger tasks_before_update before update on public.tasks
  for each row execute function private.tasks_before_update();

-- Tell the requesting team when their request is accepted or declined.
create function private.tasks_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'requested' and new.status in ('todo', 'declined') then
    perform private.notify(array[new.created_by], 'task_request_' || new.status::text,
      case when new.status = 'declined' then 'Your request was declined: ' else 'Your request was accepted: ' end || new.title,
      new.decline_reason, '/portal/tasks/' || new.id);
  end if;
  if new.status = 'in_review' and old.status <> 'in_review' then
    perform private.notify(
      array(select m.user_id from public.memberships m
            where m.team_id = new.team_id and m.role = 'executive' and m.status = 'active'),
      'task_in_review', 'Ready for review: ' || new.title, null, '/portal/tasks/' || new.id);
  end if;
  return null;
end $$;
create trigger tasks_after_update after update on public.tasks
  for each row execute function private.tasks_after_update();

-- New cross-team request: tell the receiving team's Executives.
create function private.tasks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'requested' then
    perform private.notify(
      array(select m.user_id from public.memberships m
            where m.team_id = new.team_id and m.role = 'executive' and m.status = 'active'),
      'task_request', 'New request from another team: ' || new.title, null, '/portal/tasks/' || new.id);
  end if;
  return null;
end $$;
create trigger tasks_after_insert after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- Assignees must be active members of the task's team.
create function private.task_assignees_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = new.user_id and m.team_id = v_task.team_id and m.status = 'active'
  ) then
    raise exception 'assignee_not_in_team';
  end if;
  perform private.notify(array[new.user_id], 'task_assigned', 'New task: ' || v_task.title,
    null, '/portal/tasks/' || v_task.id);
  return new;
end $$;
create trigger task_assignees_check before insert on public.task_assignees
  for each row execute function private.task_assignees_check();

-- @mentions notify people who can see the task (FR-6.3).
create function private.task_comments_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  new.mentions := array(
    select distinct u from unnest(new.mentions) as u
    where u <> new.user_id and private.can_see_task(new.task_id, u));
  select title into v_title from public.tasks where id = new.task_id;
  perform private.notify(new.mentions, 'task_mention', 'You were mentioned on: ' || v_title,
    left(new.body, 200), '/portal/tasks/' || new.task_id);
  return new;
end $$;
create trigger task_comments_mentions before insert on public.task_comments
  for each row execute function private.task_comments_mentions();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;

-- Same rule as private.can_see_task, but written against the row itself:
-- a lookup by id can't see a row that is being inserted in the same statement.
create policy "See own and managed tasks" on public.tasks for select to authenticated
  using ((select private.is_member())
         and (private.can_manage_team(team_id)
              or created_by = (select auth.uid())
              or (requested_by_team_id is not null and private.can_manage_team(requested_by_team_id))
              or private.is_task_assignee(id)));

create policy "Managers create tasks; teams send requests" on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (requested_by_team_id is null and private.can_manage_team(team_id))
      or (requested_by_team_id is not null and private.can_manage_team(requested_by_team_id))
    ));

create policy "Managers and assignees update tasks" on public.tasks for update to authenticated
  using (private.can_manage_team(team_id) or private.is_task_assignee(id) or created_by = (select auth.uid()))
  with check (private.can_manage_team(team_id) or private.is_task_assignee(id) or created_by = (select auth.uid()));

create policy "Managers delete tasks" on public.tasks for delete to authenticated
  using (private.can_manage_team(team_id));

revoke update on public.tasks from anon, authenticated;
grant update (team_id, title, description, deadline, priority, status, decline_reason)
  on public.tasks to authenticated;

create policy "See assignees of visible tasks" on public.task_assignees for select to authenticated
  using (private.can_see_task(task_id));
create policy "Managers assign" on public.task_assignees for insert to authenticated
  with check (private.can_manage_task(task_id));
create policy "Managers unassign" on public.task_assignees for delete to authenticated
  using (private.can_manage_task(task_id));

create policy "See comments of visible tasks" on public.task_comments for select to authenticated
  using (private.can_see_task(task_id));
create policy "Comment on visible tasks" on public.task_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_task(task_id));
create policy "Edit own comments" on public.task_comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own comments, managers delete any" on public.task_comments for delete to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_task(task_id));
revoke update on public.task_comments from anon, authenticated;
grant update (body) on public.task_comments to authenticated;

create policy "See attachments of visible tasks" on public.task_attachments for select to authenticated
  using (private.can_see_task(task_id));
create policy "Attach to visible tasks" on public.task_attachments for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and private.can_see_task(task_id)
              and storage_path like task_id::text || '/%');
create policy "Remove own attachments, managers remove any" on public.task_attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or private.can_manage_task(task_id));

-- ---------------------------------------------------------------------
-- Reminders and overdue flags (FR-6.4). Run every 15 minutes by pg_cron
-- (scheduled in 0006).
-- ---------------------------------------------------------------------
create function private.run_task_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_hours int := coalesce((private.setting('task_reminder_hours', '24'))::text::int, 24);
  v_task record;
begin
  -- Deadline coming up: remind the assignees.
  for v_task in
    update public.tasks t set reminder_sent_at = now()
    where t.status not in ('done', 'declined', 'requested')
      and t.reminder_sent_at is null
      and t.deadline > now() and t.deadline <= now() + make_interval(hours => v_hours)
    returning t.id, t.title, t.deadline
  loop
    perform private.notify(
      array(select user_id from public.task_assignees where task_id = v_task.id),
      'task_due_soon', 'Due soon: ' || v_task.title, null, '/portal/tasks/' || v_task.id);
  end loop;

  -- Overdue: assignees, the team's Executives and the division's Curator.
  for v_task in
    update public.tasks t set overdue_notified_at = now()
    where t.status not in ('done', 'declined', 'requested')
      and t.overdue_notified_at is null
      and t.deadline < now()
    returning t.id, t.title, t.team_id
  loop
    perform private.notify(
      array(select user_id from public.task_assignees where task_id = v_task.id)
      || array(select m.user_id from public.memberships m
               where m.status = 'active'
                 and ((m.team_id = v_task.team_id and m.role = 'executive')
                      or (m.role = 'curator' and m.division_id = private.team_division(v_task.team_id)))),
      'task_overdue', 'Overdue: ' || v_task.title, null, '/portal/tasks/' || v_task.id);
  end loop;
end $$;
