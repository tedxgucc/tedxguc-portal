-- Pillars Of Everything: title supplied by the team; TED event 63917.
-- TED lists a Salon on 10 May 2025 in Africa/Cairo (9 May 21:00 UTC).
-- Identical start/end metadata does not establish an end time.
-- This Salon shares the 2025 season without replacing its existing theme.
insert into public.seasons (year, is_active)
values (2025, false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'salon', 'Pillars Of Everything', 'pillars-of-everything',
  'TEDxGUC Salon: Pillars Of Everything. An independently organized TEDx Salon at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/63917',
  '2025-05-09T21:00:00Z'::timestamptz, null,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'SAL25'
from public.seasons where year = 2025
on conflict (slug) do nothing;
