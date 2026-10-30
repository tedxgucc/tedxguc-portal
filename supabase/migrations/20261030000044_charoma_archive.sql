-- Charoma: title supplied by the team; date, time, venue and format from
-- https://www.ted.com/tedx/events/15952 (TEDxGUCSalon).
-- The TED listing contains no speakers. Preserve existing season/event edits.
insert into public.seasons (year, theme, is_active)
values (2015, 'Charoma', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'salon', 'Charoma', 'charoma',
  'TEDxGUC Salon: Charoma. An independently organized TEDx Salon at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/15952',
  '2015-05-01T07:00:00Z'::timestamptz, '2015-05-01T14:00:00Z'::timestamptz,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'SAL15'
from public.seasons where year = 2015
on conflict (slug) do nothing;
