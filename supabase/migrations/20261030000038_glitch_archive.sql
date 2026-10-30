-- Glitch: title supplied by the team; date/venue from TED event 59932.
-- TED displays 28 September 2024 in Africa/Cairo (27 September 21:00 UTC).
-- Its identical start/end metadata does not establish an end time.
insert into public.seasons (year, theme, is_active)
values (2024, 'Glitch', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Glitch', 'glitch',
  'TEDxGUC Glitch. An independently organized TEDx event at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/59932',
  '2024-09-27T21:00:00Z'::timestamptz, null,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'TX24'
from public.seasons where year = 2024
on conflict (slug) do nothing;
