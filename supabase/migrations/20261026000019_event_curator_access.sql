-- The Chairman and every Curator manage all event setup and operations.
-- Existing policies for events, questions, staff, speakers, run of show,
-- registrations and event actions all use this permission helper.
create or replace function private.can_manage_events(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.my_role(p_uid) in ('chairman', 'curator')
$$;

-- cover_url was added after the original column-level update grant.
-- RLS still restricts editing to the event managers above.
grant update (cover_url) on public.events to authenticated;
