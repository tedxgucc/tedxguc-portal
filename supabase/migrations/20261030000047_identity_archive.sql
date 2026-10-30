-- Identity?: details and six speakers from https://www.ted.com/tedx/events/12057.
-- TED provides bios only for Ammar Abu Bakr and Omar Hisham.
-- Missing bios remain null; preserve existing records on retry.
insert into public.seasons (year, theme, is_active)
values (2014, 'Identity?', false)
on conflict (year) do nothing;

insert into public.events (
  season_id, type, title, slug, description, starts_at, ends_at,
  venue, license_status, is_public, status, ticket_prefix
)
select id, 'main_event', 'Identity?', 'identity',
  'TEDxGUC Identity? explored how communities shape who we are and how people navigate expectations and limitations. Official event listing: https://www.ted.com/tedx/events/12057',
  '2014-06-27T08:00:00Z'::timestamptz, '2014-06-27T17:00:00Z'::timestamptz,
  'German University in Cairo, New Cairo, Egypt', 'licensed', true, 'completed', 'TX14'
from public.seasons where year = 2014
on conflict (slug) do nothing;

with lineup (name, bio) as (values
  ('Ahmed Nabil', null),
  ('Ammar Abu Bakr', 'Graffiti artist known for works across Egypt, including murals on Mohamed Mahmoud Street during the revolution.'),
  ('El Hassan Makled', null),
  ('Marwan Kattan', null),
  ('Omar Hisham', 'A young game developer who began by questioning how games work, then learned through experimentation and persistence to create his own.'),
  ('Rania Reda', null)
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = 'identity'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
