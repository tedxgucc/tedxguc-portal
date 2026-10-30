-- Back & Forth: event details and eight speaker bios from
-- https://www.ted.com/tedx/events/16609. Title confirmed by the organizer.
-- Preserve existing seasons, event edits and speaker records on retry.
insert into public.seasons (year, is_active)
values (2015, false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Back & Forth', 'back-and-forth',
  'TEDxGUC Back & Forth explored change, recurring patterns and the forces that shape our lives. Official event listing: https://www.ted.com/tedx/events/16609',
  '2015-08-28T06:00:00Z'::timestamptz, '2015-08-28T17:00:00Z'::timestamptz,
  'Police Academy, Main Conference Hall, Cairo, Egypt', 'licensed', true, 'completed', 'TX15'
from public.seasons where year = 2015
on conflict (slug) do nothing;

with lineup (name, bio) as (values
  ('Ahmed Al-Kady', 'Debater and co-founder of The Intelligent Question debate club, with experience in Model United Nations and international delegations.'),
  ('Ali Aboulnasr', 'Sports management graduate and football coach developing community opportunities to help young people pursue their sporting ambitions.'),
  ('Mohamed El Zayat', 'Environmental engineer working on environmental impact assessments, clean development and energy efficiency across Middle Eastern projects.'),
  ('Mohamed Rizkallah', 'Educator with a physics background and experience in education policy, STEM education and consulting for educational initiatives.'),
  ('Shaymaa Qadry', 'Founder of GISR Institution for Survey Research, instructor in research methods and project management, and youth-development advocate.'),
  ('Sue Ellen Hassouna', 'Legal professional specializing in business law and dispute settlement, with experience advising international and regional organizations.'),
  ('Wael Habib', 'Physician specializing in musculoskeletal, spine, sports and chiropractic medicine, with experience treating elite athletes.'),
  ('Waheed Morsy', 'Telescope maker sharing astronomy through workshops and training, helping beginners build instruments and develop practical observation skills.')
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = 'back-and-forth'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
