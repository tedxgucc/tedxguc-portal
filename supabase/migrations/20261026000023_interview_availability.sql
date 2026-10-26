-- Each board member keeps their own scheduling template per team and round.
create table public.interview_availability (
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_id uuid not null references public.recruitment_cycles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  schedule jsonb not null check (jsonb_typeof(schedule) = 'object'),
  updated_at timestamptz not null default now(),
  primary key(user_id, cycle_id, team_id)
);
alter table public.interview_availability enable row level security;
revoke all on public.interview_availability from anon, authenticated;
grant select on public.interview_availability to authenticated;
create policy "Board members read own availability" on public.interview_availability for select to authenticated
  using (user_id = (select auth.uid()) and private.can_manage_team(team_id));

-- Serialize scheduling writes for every interviewer, including writes made
-- through the original slot API. Adjacent intervals remain valid.
create function private.check_interview_slot_conflict() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.users where id = any(new.interviewer_ids) order by id for update;
  if exists(select 1 from public.interview_slots s
    where s.id <> new.id and s.interviewer_ids && new.interviewer_ids
      and s.starts_at < new.ends_at and s.ends_at > new.starts_at) then
    raise exception 'interview_time_conflict';
  end if;
  return new;
end $$;
create trigger interview_slot_conflict before insert or update of starts_at, ends_at, interviewer_ids on public.interview_slots
  for each row execute function private.check_interview_slot_conflict();

-- Saving a template and publishing its new slots is one transaction. Repeating
-- publication skips exact existing slots and never replaces booked interviews.
create function public.save_interview_availability(p_cycle_id uuid, p_team_id uuid, p_schedule jsonb, p_slots jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_slot record; v_added int := 0; v_skipped int := 0;
begin
  perform 1 from public.users where id = auth.uid() for update;
  perform 1 from public.memberships where user_id = auth.uid() and season_id = private.active_season_id() and status = 'active' for share;
  if not private.can_manage_team(p_team_id) or not exists (
    select 1 from public.recruitment_cycles c join public.teams t on t.season_id = c.season_id
    where c.id = p_cycle_id and t.id = p_team_id and c.season_id = private.active_season_id() and c.kind = 'associates'
  ) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object'
    or jsonb_typeof(p_schedule -> 'weekly') is distinct from 'array'
    or jsonb_array_length(p_schedule -> 'weekly') <> 7
    or p_slots is null or jsonb_typeof(p_slots) <> 'array' then raise exception 'invalid_availability'; end if;
  if jsonb_array_length(p_slots) > 500 then raise exception 'too_many_slots'; end if;
  for v_slot in select * from jsonb_to_recordset(p_slots) as x(starts_at timestamptz, ends_at timestamptz) loop
    if v_slot.starts_at is null or v_slot.ends_at is null or v_slot.starts_at <= now()
      or v_slot.ends_at <= v_slot.starts_at or v_slot.ends_at - v_slot.starts_at > interval '4 hours' then
      raise exception 'invalid_interview_time';
    end if;
    if exists(select 1 from public.interview_slots s where s.cycle_id = p_cycle_id and s.team_id = p_team_id
      and s.starts_at = v_slot.starts_at and s.ends_at = v_slot.ends_at and auth.uid() = any(s.interviewer_ids)) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.interview_slots(cycle_id, team_id, starts_at, ends_at, location, interviewer_ids)
      values(p_cycle_id, p_team_id, v_slot.starts_at, v_slot.ends_at, nullif(trim(p_schedule ->> 'location'), ''), array[auth.uid()]);
    v_added := v_added + 1;
  end loop;
  insert into public.interview_availability(user_id, cycle_id, team_id, schedule)
    values(auth.uid(), p_cycle_id, p_team_id, p_schedule)
    on conflict(user_id, cycle_id, team_id) do update set schedule = excluded.schedule, updated_at = now();
  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end $$;
revoke all on function public.save_interview_availability(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_interview_availability(uuid, uuid, jsonb, jsonb) to authenticated;
