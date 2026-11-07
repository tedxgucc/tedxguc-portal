-- The Chairman deletes a member from the club. Their membership becomes
-- 'removed' (no portal access); their past work stays attributed to them.
create function public.delete_member(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then raise exception 'cannot_delete_yourself'; end if;
  select m.id into v_id from public.memberships m
    join public.seasons s on s.id = m.season_id and s.is_active
    where m.user_id = p_user_id and m.status = 'active' for update;
  if v_id is null then raise exception 'not_a_member'; end if;
  delete from public.team_memberships where membership_id = v_id;
  delete from public.task_assignees ta using public.tasks t
    where ta.task_id = t.id and ta.user_id = p_user_id and t.status not in ('done', 'declined');
  update public.memberships set status = 'removed' where id = v_id;
end $$;
revoke execute on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
