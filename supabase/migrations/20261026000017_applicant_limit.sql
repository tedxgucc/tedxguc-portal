-- Applicant limit per team (FR-4.2). A position's "seats" now means the
-- maximum number of applicants who pick that team as their FIRST choice.
-- Once reached, the team is full: nobody else can pick it first (it can
-- still be a second preference). Withdrawn applications don't count.
comment on column public.positions.seats is 'Maximum first-choice applicants; null = no limit.';

create function private.first_choice_count(p_cycle uuid, p_team uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.applications
  where cycle_id = p_cycle and team_choices[1] = p_team and stage <> 'withdrawn'
$$;

create function private.applications_check_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_seats int;
begin
  select seats into v_seats from public.positions
   where cycle_id = new.cycle_id and team_id = new.team_choices[1];
  if v_seats is null then return new; end if;
  -- One applicant at a time per team, so two people can't take the last place together.
  perform pg_advisory_xact_lock(hashtext('applicants:' || new.cycle_id::text || ':' || new.team_choices[1]::text));
  if private.first_choice_count(new.cycle_id, new.team_choices[1]) >= v_seats then
    raise exception 'team_full';
  end if;
  return new;
end $$;

create trigger applications_check_limit before insert on public.applications
  for each row execute function private.applications_check_limit();

-- For the Join page: how full each team is (counts only, no names).
create function public.position_fill(p_cycle_id uuid)
returns table (team_id uuid, seats int, applicants int, is_full boolean)
language sql stable security definer set search_path = '' as $$
  select p.team_id, p.seats, private.first_choice_count(p.cycle_id, p.team_id),
         p.seats is not null and private.first_choice_count(p.cycle_id, p.team_id) >= p.seats
  from public.positions p where p.cycle_id = p_cycle_id
$$;
grant execute on function public.position_fill(uuid) to anon, authenticated;
