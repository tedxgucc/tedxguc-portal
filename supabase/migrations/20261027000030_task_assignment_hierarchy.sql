-- Delegate tasks through the role hierarchy, retaining team-based tasks.
create or replace function private.task_assignees_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks;
  v_target record;
  v_role public.member_role := private.my_role();
begin
  select * into v_task from public.tasks where id = new.task_id;
  select * into v_target from private.membership_of(new.user_id);
  if not found then raise exception 'assignee_not_in_team'; end if;
  if not (private.has_team_membership(v_task.team_id, new.user_id)
      or (v_target.role = 'curator' and v_target.division_id = private.team_division(v_task.team_id))) then
    raise exception 'assignee_not_in_team';
  end if;
  if not coalesce(private.can_manage_team(v_task.team_id) and (
    (v_role = 'chairman' and v_target.role in ('curator', 'executive'))
    or (v_role = 'curator' and v_target.role in ('executive', 'associate'))
    or (v_role = 'executive' and v_target.role = 'associate')
  ), false) then
    raise exception 'assignee_not_allowed' using errcode = '42501';
  end if;
  perform private.notify(array[new.user_id], 'task_assigned', 'New task: ' || v_task.title,
    null, '/portal/tasks/' || v_task.id);
  return new;
end $$;
