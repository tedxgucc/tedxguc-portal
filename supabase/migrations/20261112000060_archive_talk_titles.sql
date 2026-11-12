-- Talk titles for archive talks, taken from the earlier TEDxGUC site (tedxguc.vercel.app/talks).
-- Only fills empty titles; matches by speaker name.
update public.speakers s set talk_title = v.title
from (values
  ('Rasha Maaty', 'Civil Work: Putting Syrian refugees back on their feet'),
  ('Youssef Farag', 'Restructuring our living spaces through container architecture'),
  ('Nada El Shanawany', 'Can we still say that there are plenty of fish in the sea by 2050?'),
  ('Reem Hashem', 'Drama Therapy: An unlikely solution to a common problem'),
  ('Rasha Hanafi', 'A biomarker saving lives'),
  ('Caroline Mitry', 'Mental illness representation in Egyptian movies'),
  ('Omar Sabaa', 'A sustainable development model for red sea rural areas'),
  ('Sara Abdel-Aziz', 'Post chemotherapy: Getting ovaries back to life'),
  ('Yehia Abugabal', 'Research: The marginalized dimension in our fight against cancer'),
  ('Rania Abdelaziz', 'Beyond limits, different is beautiful'),
  ('Alaa El Masry', 'Beyond limits, different is beautiful'),
  ('Mahmoud Hawary', 'Reclaiming Egypt''s narrative'),
  ('Yahya Hefnawi', 'From machines to bodies'),
  ('Youssef El Akkari', 'Getting companies racing to hire you'),
  ('Ahmed El Helaly', 'Bridging the professional gap: The transformative power of network'),
  ('Shereen Rizk', 'It didn''t start with you'),
  ('Dibo', 'Creating movie magic!'),
  ('Rowan El Selmy', 'Bringing the past to life'),
  ('Ali Aboulnasr', 'Goal Of Equality'),
  ('Mohamed Rizkallah', 'STEM-ED'),
  ('Sara Aziz', 'Exposing hidden dimensions of Child Sexual Abuse.'),
  ('Sue Ellen Hassouna', 'Criminals in Suits'),
  ('Carol Hammal', 'Art therapy: a world beyond creative expression'),
  ('Abdelrahman Ghareeb', 'The Game of Numbers'),
  ('Bassem Abdelmalek', 'More Than A Roof: What Children Really Need'),
  ('Mostafa Kamel', 'The Narrative We Live In'),
  ('Ahmed Samy', 'The Illusion Of One Road And 51 That Prove Otherwise'),
  ('Aida Shaaban', 'Redefining Our Relationship With Food'),
  ('Rami Hamdi', 'A Story Called Beauty'),
  ('Mostafa Adel', 'Off Key…On Path'),
  ('Mostafa Salem', 'من عقدة الخواجة ل عقدة للخواجة')
) as v(name, title)
where lower(regexp_replace(s.name, '[^a-zA-Z]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z]', '', 'g'))
  and (s.talk_title is null or s.talk_title = '');
