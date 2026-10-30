-- Synergizers: verified date, venue and description from TED event 6034.
-- https://www.ted.com/tedx/events/6034 identifies this as TEDxGUC's first event.
-- No speaker names are published on the listing. Do not invent a lineup.
insert into public.seasons (year, theme, is_active)
values (2013, 'Synergizers', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Synergizers', 'synergizers',
  'TEDxGUC''s first event, Synergizers, explored synergy and the collective power of ideas. Live speakers and screened talks brought different perspectives on collaboration and shared possibilities. Official event listing: https://www.ted.com/tedx/events/6034',
  '2013-04-26T08:00:00Z'::timestamptz, '2013-04-26T17:00:00Z'::timestamptz,
  'University Auditorium, German University in Cairo, New Cairo, Egypt',
  'licensed', true, 'completed', 'TX13'
from public.seasons where year = 2013
on conflict (slug) do nothing;
