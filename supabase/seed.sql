-- 2027 season setup (FR-3.2) and default settings.
-- Safe to run on a fresh database. Run as the database owner.

insert into public.seasons (year, theme, is_active, activated_at)
values (2027, null, true, now())
on conflict (year) do nothing;

with s as (select id from public.seasons where year = 2027)
insert into public.divisions (season_id, name, kind)
select s.id, d.name, d.kind::public.division_kind
from s, (values
  ('Talks', 'talks'),
  ('Operations', 'operations'),
  ('Organizational Development', 'org_development'),
  ('Marketing & Coordination', 'marketing')
) as d (name, kind)
on conflict (season_id, name) do nothing;

with s as (select id from public.seasons where year = 2027)
insert into public.teams (season_id, division_id, name, kind)
select s.id, d.id, t.name, t.kind::public.team_kind
from s
join (values
  ('talks', 'Coaching', 'coaching'),
  ('talks', 'Research and Production', 'research_production'),
  ('operations', 'Logistics and Planning', 'logistics_planning'),
  ('operations', 'Partnerships', 'partnerships'),
  ('org_development', 'Associates'' Experience', 'associates_experience'),
  ('org_development', 'Associates'' Development', 'associates_development'),
  ('marketing', 'Campaigns and Copyrights', 'campaigns_copyrights'),
  ('marketing', 'Media and Design', 'media_design')
) as t (division_kind, name, kind) on true
join public.divisions d on d.season_id = s.id and d.kind = t.division_kind::public.division_kind
on conflict (season_id, name) do nothing;

-- Defaults from "Decisions to confirm" in docs/requirements.md.
with s as (select id from public.seasons where year = 2027)
insert into public.settings (season_id, key, value)
select s.id, v.key, v.value::jsonb
from s, (values
  ('lates_per_absence', '2'),
  ('absence_levels', '[{"level": 2, "action": "warn_member"}, {"level": 3, "action": "notify_curator"}]'),
  ('excuse_window_hours', '48'),
  ('attendance_edit_window_hours', '48'),
  ('expense_chairman_limit_egp', '5000'),
  ('task_reminder_hours', '24')
) as v (key, value)
on conflict (season_id, key) do nothing;

-- Starting text for the public site (FR-1.4). The Chairman edits the club
-- sections; each Curator edits their division's section from /portal/site.
insert into public.site_sections (key, owner_kind, title, body, is_published, updated_by) values
  ('about', null, 'About TEDxGUC', '{"text": "TEDxGUC is the TEDx chapter at the German University in Cairo, run by students since 2013. Every season a new board brings speakers, ideas and hundreds of guests together in one hall."}', true, null),
  ('tedx', null, 'TED and TEDx', '{"text": "TED is a nonprofit devoted to ideas worth spreading. TEDx events are independently organized under a free license from TED, bringing the TED format to local communities."}', true, null),
  ('faq', null, 'FAQ', '{"items": [{"q": "Are tickets free?", "a": "Yes. Tickets are free; seats are limited, so register early."}, {"q": "Do I need an account?", "a": "No. Register with your name and email; your ticket arrives by email with a private link."}, {"q": "I lost my ticket.", "a": "Open the event page and use Lost your ticket. We will email it again."}, {"q": "Can I join the team?", "a": "We recruit at the start of each season. Watch the Join the team page and our Instagram."}]}', true, null),
  ('talks', 'talks', 'Talks', '{"text": "We find, research and coach the speakers you see on stage."}', true, null),
  ('operations', 'operations', 'Operations', '{"text": "Venues, suppliers, partners and every event day."}', true, null),
  ('org_development', 'org_development', 'Organizational Development', '{"text": "We look after the people who make TEDxGUC."}', true, null),
  ('marketing', 'marketing', 'Marketing & Coordination', '{"text": "Campaigns, copy, photos and design."}', true, null)
on conflict (key) do nothing;
