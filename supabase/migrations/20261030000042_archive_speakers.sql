-- Speaker names and concise bios based on TED listings:
-- Under Construction: https://www.ted.com/tedx/events/65988 (8 speakers)
-- Glitch: https://www.ted.com/tedx/events/59932 (8 speakers)
-- Whitespace: https://www.ted.com/tedx/events/56129 (10 speakers)
-- Pillars Of Everything has no speaker lineup on its TED page.
-- Apply the archive event migrations first. Preserve existing speaker edits.
do $$
begin
  if (select count(*) from public.events where slug in ('under-construction', 'glitch', 'whitespace')) <> 3 then
    raise exception 'Apply the archive event migrations before adding speakers';
  end if;
end $$;

with lineup (slug, name, bio) as (values
  ('under-construction', 'Abdelrahman Ghareeb', 'Founder of SEE, using video analytics to improve athletic performance. His talk explores what we can learn from what is missing.'),
  ('under-construction', 'Ahmed Samy', 'Entrepreneur exploring resilience and experimentation. His talk considers how trying different paths can help us find our way.'),
  ('under-construction', 'Aida Shaaban', 'Chef, food consultant and wellness coach exploring the connections between food, wellbeing, identity and healing.'),
  ('under-construction', 'Bassem Abdelmalek', 'Founder of a father-and-child camp initiative. He explores engaged parenting and the value of being present.'),
  ('under-construction', 'Mostafa Adel', 'Creator of The Audio Bus, exploring identity and reinvention through sound. His talk uses music to examine growth and fresh starts.'),
  ('under-construction', 'Mostafa Kamel', 'Brand and marketing specialist and multidisciplinary creative exploring identity beyond labels and navigating personal and professional uncertainty.'),
  ('under-construction', 'Mostafa Salem', 'Architectural designer and urban advocate exploring how better public spaces can transform communities and everyday life.'),
  ('under-construction', 'Rami Hamdi', 'Writer questioning standardized beauty and curated digital ideals. His talk explores perception, authenticity and paying closer attention.'),
  ('glitch', 'Amir Roushdy', 'GUC mechatronics and robotics professor and ARAtronics director, connecting research, industry and human creativity through AI and robotics.'),
  ('glitch', 'Haitham Gheita', 'Sports mental coach and HG Mental Academy founder, helping athletes across many sports develop their mental performance.'),
  ('glitch', 'Manal Olama', 'Egyptian Clothing Bank CEO and Almah founder, working in sustainable fashion, circular production and community support.'),
  ('glitch', 'Mohamed Ehab', 'Entrepreneur at Entlaq Holding with experience in mobility and robotics, a GUC engineering background and international squash competition.'),
  ('glitch', 'Sherif El Sayed', 'Graphic designer and junior art director exploring how first and second languages influence emotions and society.'),
  ('glitch', 'Sohaila Omar', 'Ancient Egyptian archaeology researcher, author and content creator sharing museum stories and Egyptian heritage.'),
  ('glitch', 'Yara Hesham', 'Archstudios founder and architecture graduate with interests in urban design, social media management and content creation.'),
  ('glitch', 'Yassin Mahgoub', 'Medical graduate and animal advocate sharing experiences in medicine, volunteering and everyday life through humorous and motivational content.'),
  ('whitespace', 'Ahmed El Helaly', 'Life coach and NLP practitioner who moved from commerce into coaching and training, with involvement in ICF Egypt.'),
  ('whitespace', 'Alaa El Masry', 'Learning difficulties and disabilities teacher studying psychology, and founder of Peace of Heart, a disability-awareness platform.'),
  ('whitespace', 'Dibo', 'Film and commercial director with an international strategy background, bringing travel, storytelling and imaginative world-building into filmmaking.'),
  ('whitespace', 'Ibrahim Ahmed', 'Psychologist, school counselor and content creator examining criminal behavior, forensic research and body language.'),
  ('whitespace', 'Mahmoud Hawary', 'Art director, documentary filmmaker and visual artist, and founder of Humans of Upper Egypt.'),
  ('whitespace', 'Rania Abdelaziz', 'Speech and language specialist and advanced DIRFloortime provider supporting children and families through child-led practice and parent coaching.'),
  ('whitespace', 'Rowan El Selmy', 'WeAreDesco co-founder, architect and teaching assistant exploring computational design, AI and metaverse design.'),
  ('whitespace', 'Shereen Rizk', 'Family and business constellation facilitator, Enneagram teacher and Reiki practitioner offering workshops on personal and professional dynamics.'),
  ('whitespace', 'Yahya Hefnawi', 'Computer engineering student at the Technical University of Munich and Apple intern, interested in AI and its real-world impact.'),
  ('whitespace', 'Youssef El Akkari', 'Growth marketing consultant and podcast host with experience in digital advertising, automation, funnels and international brand work.')
)
insert into public.speakers (season_id, event_id, name, bio, is_public)
select e.season_id, e.id, l.name, l.bio, true
from lineup l join public.events e on e.slug = l.slug
where not exists (
  select 1 from public.speakers s
  where s.event_id = e.id and lower(trim(s.name)) = lower(trim(l.name))
);
