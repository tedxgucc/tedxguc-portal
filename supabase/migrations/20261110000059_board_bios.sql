-- Board intros: each member can write a short public bio for the Board page.
alter table public.users add column if not exists bio text check (bio is null or char_length(bio) <= 400);
grant update (bio) on public.users to authenticated;

drop function if exists public.get_public_board();
create function public.get_public_board()
returns table (name text, photo_url text, role public.member_role, division text, team text, bio text, major text)
language sql stable security definer set search_path = '' as $$
  select u.name, u.photo_url, m.role, d.name, t.name, u.bio, u.major
  from public.memberships m
  join public.seasons s on s.id = m.season_id and s.is_active
  join public.users u on u.id = m.user_id
  left join public.divisions d on d.id = m.division_id
  left join public.teams t on t.id = m.team_id
  where m.status = 'active' and m.role in ('chairman', 'curator', 'executive')
  order by array_position(array['chairman', 'curator', 'executive']::public.member_role[], m.role), d.name, t.name, u.name
$$;
grant execute on function public.get_public_board() to anon, authenticated;
