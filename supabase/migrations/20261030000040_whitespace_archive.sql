-- Whitespace: title supplied by the team; TED event 56129.
-- TED displays 9 October 2023 in Africa/Cairo (8 October 21:00 UTC).
-- Identical start/end metadata does not establish an end time.
insert into public.seasons (year, theme, is_active)
values (2023, 'Whitespace', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Whitespace', 'whitespace',
  'TEDxGUC Whitespace. An independently organized TEDx event at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/56129',
  '2023-10-08T21:00:00Z'::timestamptz, null,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'TX23'
from public.seasons where year = 2023
on conflict (slug) do nothing;
