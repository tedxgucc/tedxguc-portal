-- Event deletion uses the same Chairman/Curator permission as event editing.
-- Keep registration and finance records protected by their foreign keys.
create or replace function public.delete_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.can_manage_events(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;
  delete from public.events where id = p_event_id;
exception when foreign_key_violation then
  raise exception 'event_has_records';
end $$;
revoke all on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;
