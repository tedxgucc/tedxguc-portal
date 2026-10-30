-- Organizer-provided lineup, talk titles and biographies.
-- Apply the Pillars Of Everything event migration first.
-- Preserve existing speaker records and any subsequent portal edits.
do $$
begin
  if not exists (select 1 from public.events where slug = 'pillars-of-everything') then
    raise exception 'Apply the Pillars Of Everything archive event migration first';
  end if;
end $$;

with lineup (name, talk_title, bio) as (values
  ('Menna El Naggar', 'The Human Experience: Stories That Heal, Inspire and Transform', 'The creative force behind Artiffied, Menna explores art not just as a form of expression, but as a core pillar of how we experience the world.'),
  ('Nancy Maher', 'The Pillars Within: Simulated Connection, Real Disconnection', 'A Professional Certified Coach (PCC) accredited by the International Coaching Federation, certified life & relationship coach, and NLP practitioner. With a strong academic background in Pharmaceutical Chemistry and Business Administration from GUC, she bridges science and personal development.'),
  ('Moaz Akram', 'The Points You Never Knew You Were Scoring', 'A professional modern pentathlete with 12 years of experience, a national medalist, and a podium finisher at the 2024 World Championship. He is also a fitness and fencing coach dedicated to building physical strength and mental toughness in others.'),
  ('Gohar Said', 'Entrepreneurship''s Silent Battles: The Unfiltered Truth', 'An innovative mind behind Suplyd and Maine. With a background in engineering and a sharp eye for solving real-world problems, he builds startups that transform industries and challenge how we think about innovation and leadership.'),
  ('Roberto Joseph', 'Signed Out to Sign In', 'A digital multi-talented creator who has worked as a software engineer in Dubai, founded SwiftJobs, and served as the Cross-Platform Lead at Ernest in Miami. He channels his expertise into creating disruptive, authentic tech content on TikTok as @techwruby')
)
insert into public.speakers (season_id, event_id, name, talk_title, bio, is_public)
select e.season_id, e.id, l.name, l.talk_title, l.bio, true
from lineup l join public.events e on e.slug = 'pillars-of-everything'
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
