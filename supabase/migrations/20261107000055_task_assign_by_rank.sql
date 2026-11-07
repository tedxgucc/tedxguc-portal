-- Who can assign whom on a task:
--   Chairman  -> any Curator or Executive (the whole board)
--   Curator   -> any Executive or Associate in their division
--   Executive -> Associates on their own team
create or replace function private.task_assignees_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks;
  v_me record;
  v_target record;
  v_ok boolean := false;
begin
  select * into v_task from public.tasks where id = new.task_id;
  select * into v_me from private.membership_of(auth.uid());
  select * into v_target from private.membership_of(new.user_id);
  if v_target.membership_id is null then raise exception 'assignee_not_in_team'; end if;
  if v_me.role = 'chairman' then
    v_ok := v_target.role in ('curator', 'executive');
  elsif v_me.role = 'curator' then
    v_ok := v_target.role in ('executive', 'associate') and private.can_manage_team(v_task.team_id);
    if v_ok and not (v_target.division_id = v_me.division_id or exists (
        select 1 from public.team_memberships tm join public.teams t on t.id = tm.team_id
        where tm.membership_id = v_target.membership_id and t.division_id = v_me.division_id)) then
      raise exception 'assignee_not_in_team';
    end if;
  elsif v_me.role = 'executive' then
    v_ok := v_target.role = 'associate' and private.can_manage_team(v_task.team_id);
    if v_ok and not private.has_team_membership(v_task.team_id, new.user_id) then
      raise exception 'assignee_not_in_team';
    end if;
  end if;
  if not coalesce(v_ok, false) then
    raise exception 'assignee_not_allowed' using errcode = '42501';
  end if;
  perform private.notify(array[new.user_id], 'task_assigned', 'New task: ' || v_task.title,
    null, '/portal/tasks/' || v_task.id);
  return new;
end $$;
