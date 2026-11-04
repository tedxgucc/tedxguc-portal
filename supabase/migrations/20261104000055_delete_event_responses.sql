-- Delete event responses and setup atomically; retain accounting history.
create or replace function public.delete_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.can_manage_events(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;

  delete from public.checkin_scans
    where event_id = p_event_id
       or registration_id in (select id from public.registrations where event_id = p_event_id);
  delete from public.registrations where event_id = p_event_id;
  update public.expense_requests set event_id = null where event_id = p_event_id;
  update public.transactions set event_id = null where event_id = p_event_id;
  -- Fields, staff and run of show cascade; speaker profiles are unlinked.
  delete from public.events where id = p_event_id;
end $$;
revoke all on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;
