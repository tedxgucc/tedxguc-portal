-- Cascade: event details and nine speaker bios based on TED event 20479.
-- https://www.ted.com/tedx/events/20479
-- Preserve existing season, event and speaker edits on retries.
insert into public.seasons (year, theme, is_active)
values (2016, 'Cascade', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Cascade', 'cascade',
  'TEDxGUC Cascade explored continuity, change and how ideas pass between people. Official event listing: https://www.ted.com/tedx/events/20479',
  '2016-08-06T10:30:00Z'::timestamptz, '2016-08-06T19:00:00Z'::timestamptz,
  'AUC Bassily Hall, Cairo, Egypt', 'licensed', true, 'completed', 'TX16'
from public.seasons where year = 2016
on conflict (slug) do nothing;

with lineup (name, bio) as (values
  ('Ahmad Saqfalhait', 'Jordanian graphic designer and educator exploring new approaches to Arabic design, with postgraduate design study in Japan.'),
  ('Lobna Mourad', 'Molecular microbiology researcher studying antibiotic resistance and early detection of hepatitis C-related liver cancer.'),
  ('Mahmoud Mansi', 'Author, entrepreneur and founder of HR Revolution Magazine, sharing perspectives on human resources and business journalism.'),
  ('Mohamed Mounir', 'Egyptian engineer and inventor exploring structures designed to reduce damage from water-related disasters.'),
  ('Mona Marie', 'Graphic design instructor at the German University in Cairo.'),
  ('Radwa Rostom', 'Civil engineer and Hand Over founder using sustainable construction to support community development and affordable housing.'),
  ('Sara Aziz', 'Safe Foundation founder raising awareness of child sexual abuse and supporting survivors through counseling.'),
  ('Yasmin Youssef', 'Education technology specialist and teacher trainer helping educators integrate digital media and interactive tools into learning.'),
  ('Yousra Mounir', 'Amaken founder creating travel experiences that connect people, cultures and nature through responsible tourism and self-exploration.')
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = 'cascade'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
