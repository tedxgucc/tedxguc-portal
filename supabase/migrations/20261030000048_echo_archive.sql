-- Echo: organizer-provided name, speaker lineup and biographies.
-- Date, format and city: https://www.ted.com/tedx/events/58700.
-- 11 May 2024 in Cairo (10 May 21:00 UTC); exact venue/end time not listed.
-- Preserve existing season, event and speaker edits on retries.
insert into public.seasons (year, is_active)
values (2024, false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'salon', 'Echo', 'echo-2024',
  'TEDxGUC Salon: Echo. An independently organized TEDx Salon in Cairo. Official event listing: https://www.ted.com/tedx/events/58700',
  '2024-05-10T21:00:00Z'::timestamptz, null,
  'Cairo, Egypt', 'licensed', true, 'completed', 'SAL24'
from public.seasons where year = 2024
on conflict (slug) do nothing;

with lineup (name, bio) as (values
  ('Menna Metwally', 'Known for her creative, fun content and multiple stage talks with SheCan, Menna holds a bachelor''s degree in Electrical, Electronics & Communications Engineering. With a one-of-a-kind personality, she brings an inspiring ride to the stage.'),
  ('Mamdouh Saud', 'With a degree in Applied Arts & Textile Engineering, Mamdouh infuses creativity with a result-driven business approach. As the leader of Toroun - a strategy, branding, and digital marketing agency - his mission is to develop iconic brands and help them make an impact.'),
  ('Hanaa Medhat', 'With expertise in branding and digital marketing, Hanaa has helped over 50 startups and entrepreneurs build their digital image. She holds a Train of Trainers Certification from Warnborough College and conducts workshops all over Egypt.'),
  ('Raghda Moataz', 'A young published author of her first book, Absolute Egypt, Raghda also teaches workshops and has been featured in platforms like Slanted magazine, Cairo Scene, and Women of Egypt.')
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = 'echo-2024'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
