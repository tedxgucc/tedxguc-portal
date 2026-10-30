-- Optional event-specific logos on tickets; existing event permissions apply.
alter table public.events add column ticket_partners jsonb not null default '[]'::jsonb
  check (jsonb_typeof(ticket_partners) = 'array');
grant update (ticket_partners) on public.events to authenticated;

create or replace function public.get_registration_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'registration_id', r.id, 'status', r.status, 'guest_name', r.guest_name, 'guest_type', r.guest_type,
    'ticket_no', r.ticket_no,
    'ticket_code', case when r.status = 'registered' then r.ticket_code end,
    'checked_in_at', r.checked_in_at,
    'waitlist_position', case when r.status = 'waitlisted' then (
        select count(*) from public.registrations w
        where w.event_id = r.event_id and w.status = 'waitlisted'
          and (w.created_at, w.id) <= (r.created_at, r.id)) end,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at,
                                'ends_at', e.ends_at, 'venue', e.venue, 'ticket_partners', e.ticket_partners))
  from public.registrations r
  join public.events e on e.id = r.event_id
  where r.status_token_hash = private.hash_token(p_status_token)
$$;

