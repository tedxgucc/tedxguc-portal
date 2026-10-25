-- Season setup in one step (FR-3.2, FR-14.1).
-- The Chairman prepares next season before switching it on: the new
-- season gets a copy of this season's divisions, teams and settings, and
-- the incoming Chairman's membership. activate_season() then switches.
create function public.prepare_season(p_year int, p_theme text, p_chairman uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid := private.active_season_id();
  v_new uuid;
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.seasons where year = p_year) then
    raise exception 'season_exists';
  end if;
  if not exists (select 1 from public.users where id = p_chairman) then
    raise exception 'chairman_not_found';
  end if;

  insert into public.seasons (year, theme) values (p_year, nullif(trim(p_theme), '')) returning id into v_new;

  insert into public.divisions (season_id, name, kind)
  select v_new, name, kind from public.divisions where season_id = v_old;

  insert into public.teams (season_id, division_id, name, kind, description)
  select v_new, nd.id, t.name, t.kind, t.description
  from public.teams t
  join public.divisions od on od.id = t.division_id
  join public.divisions nd on nd.season_id = v_new and nd.name = od.name
  where t.season_id = v_old;

  insert into public.settings (season_id, key, value)
  select v_new, key, value from public.settings where season_id = v_old;

  insert into public.memberships (user_id, season_id, role) values (p_chairman, v_new, 'chairman');

  perform private.log_action('season_prepared', 'seasons', v_new::text,
    jsonb_build_object('year', p_year, 'chairman', p_chairman));
  return v_new;
end $$;

revoke execute on function public.prepare_season(int, text, uuid) from public, anon;
grant execute on function public.prepare_season(int, text, uuid) to authenticated;
