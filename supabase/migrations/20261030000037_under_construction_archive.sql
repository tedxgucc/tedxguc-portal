-- Archive entry requested by the team. Title supplied by the organizer;
-- date, time and venue: https://www.ted.com/tedx/events/65988
-- Keep the historical season inactive and never overwrite an existing event.
insert into public.seasons (year, theme, is_active)
values (2025, 'Under Construction', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Under Construction', 'under-construction',
  'TEDxGUC Under Construction. A day of independently organized talks at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/65988',
  '2025-09-27T13:00:00Z'::timestamptz, '2025-09-27T18:00:00Z'::timestamptz,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'TX25'
from public.seasons where year = 2025
on conflict (slug) do nothing;
