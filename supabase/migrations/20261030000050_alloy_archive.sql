-- Alloy: event details and eleven speaker bios based on TED event 24683.
-- https://www.ted.com/tedx/events/24683
-- 23 September 2017 in Cairo (22 September 22:00 UTC).
-- Identical start/end metadata does not establish an end time.
insert into public.seasons (year, theme, is_active)
values (2017, 'Alloy', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Alloy', 'alloy',
  'TEDxGUC Alloy explored how different perspectives combine to shape communities and personal identity. Official event listing: https://www.ted.com/tedx/events/24683',
  '2017-09-22T22:00:00Z'::timestamptz, null,
  'AUC Bassily Hall, Cairo, Egypt', 'licensed', true, 'completed', 'TX17'
from public.seasons where year = 2017
on conflict (slug) do nothing;

with lineup (name, bio) as (values
  ('Caroline Mitry', 'Educator and assessment specialist exploring representations of mental illness in Egyptian cinema.'),
  ('Nada El Shanawany', 'Environmental management specialist with a background in marine biodiversity and conservation.'),
  ('Omar Sabaa', 'Antakh and ScubaDive Egypt founder supporting sustainable development in Red Sea communities.'),
  ('Rasha Hanafi', 'GUC pharmaceutical analysis professor, researcher and consultant in analytical chemistry.'),
  ('Rasha Maaty', 'Fard Foundation director supporting refugees through education, livelihoods and community services.'),
  ('Reem Hashem', 'Drama therapist using storytelling, role play and theatrical techniques in therapeutic practice.'),
  ('Salsabil Amin', 'Product designer combining architecture and other design disciplines to serve everyday life.'),
  ('Sara Abdel-Aziz', 'Obstetrics and gynecology lecturer researching cord blood stem cells and banking.'),
  ('Yaser Ayoub', 'Sports journalist and media professional advocating for athletes across different sports.'),
  ('Yehia Abugabal', 'Clinical oncologist and International Cancer Research Center founder supporting research and awareness.'),
  ('Youssef Farag', 'Qubix co-founder managing sales, operations and finance, with an interest in urban development.')
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = 'alloy'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
