-- =====================================================================
-- 0061 · Orientation: before an associates round opens, GUC students
--        sign up for one orientation day (there are usually two) where
--        the club introduces TEDx and the teams.
--
-- Not an event: it never shows on the events pages or tickets. Days
-- belong to a recruitment round; the Chairman adds them. Guests sign up
-- through the public-forms server function with their GUC student email,
-- so only GUCians can register. One sign-up per GUC ID per round.
-- =====================================================================

create table public.orientation_days (
  id         uuid primary key default gen_random_uuid(),
  cycle_id   uuid not null references public.recruitment_cycles (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  location   text,
  capacity   int check (capacity > 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index orientation_days_cycle_idx on public.orientation_days (cycle_id, starts_at);

create table public.orientation_signups (
  id         uuid primary key default gen_random_uuid(),
  cycle_id   uuid not null references public.recruitment_cycles (id) on delete cascade,
  day_id     uuid not null references public.orientation_days (id) on delete cascade,
  name       text not null check (length(trim(name)) between 2 and 120),
  guc_id     text not null check (guc_id ~ '^\d{1,3}-\d{3,6}$'),
  email      text not null check (email = lower(email) and email ~ '^[^@\s]+@student\.guc\.edu\.eg$'),
  team_ids   uuid[] not null check (cardinality(team_ids) between 1 and 3),
  attended   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (cycle_id, guc_id),
  unique (cycle_id, email)
);
create index orientation_signups_day_idx on public.orientation_signups (day_id);

alter table public.orientation_days enable row level security;
alter table public.orientation_signups enable row level security;

create policy "Anyone sees orientation days" on public.orientation_days for select to anon, authenticated using (true);
create policy "Chairman adds orientation days" on public.orientation_days for insert to authenticated with check ((select private.is_chairman()));
create policy "Chairman edits orientation days" on public.orientation_days for update to authenticated using ((select private.is_chairman())) with check ((select private.is_chairman()));
create policy "Chairman removes orientation days" on public.orientation_days for delete to authenticated using ((select private.is_chairman()));

-- Board members see the students interested in their teams; the Chairman sees everyone.
create policy "Board sees interested students" on public.orientation_signups for select to authenticated
  using ((select private.is_chairman()) or private.can_review_application(team_ids));
create policy "Board marks attendance" on public.orientation_signups for update to authenticated
  using ((select private.is_chairman()) or private.can_review_application(team_ids))
  with check ((select private.is_chairman()) or private.can_review_application(team_ids));
create policy "Chairman removes sign-ups" on public.orientation_signups for delete to authenticated using ((select private.is_chairman()));

grant select on public.orientation_days to anon, authenticated;
grant insert, update, delete on public.orientation_days to authenticated;
revoke all on public.orientation_signups from anon;
grant select, update (attended), delete on public.orientation_signups to authenticated;

-- How full each day is (public: counts only, no names).
create function public.orientation_day_counts(p_cycle_id uuid)
returns table (day_id uuid, signed_up int, capacity int, is_full boolean)
language sql stable security definer set search_path = '' as $$
  select d.id, count(s.id)::int, d.capacity, d.capacity is not null and count(s.id) >= d.capacity
  from public.orientation_days d
  left join public.orientation_signups s on s.day_id = d.id
  where d.cycle_id = p_cycle_id
  group by d.id
$$;
grant execute on function public.orientation_day_counts(uuid) to anon, authenticated;

-- Called by the public-forms server function only.
create function public.sign_up_for_orientation(p_day_id uuid, p_name text, p_guc_id text, p_email text, p_team_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_day public.orientation_days;
  v_count int;
  v_email text := lower(trim(p_email));
  v_guc text := trim(p_guc_id);
begin
  select * into v_day from public.orientation_days where id = p_day_id for update;
  if not found then raise exception 'orientation_not_found'; end if;
  if v_day.ends_at < now() then raise exception 'orientation_over'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if v_guc !~ '^\d{1,3}-\d{3,6}$' then raise exception 'invalid_guc_id'; end if;
  if v_email !~ '^[^@\s]+@student\.guc\.edu\.eg$' then raise exception 'not_gucian'; end if;
  if cardinality(p_team_ids) not between 1 and 3
     or (select count(distinct t) from unnest(p_team_ids) t) <> cardinality(p_team_ids)
     or exists (select 1 from unnest(p_team_ids) t where not exists (select 1 from public.teams x where x.id = t)) then
    raise exception 'invalid_orientation_teams';
  end if;
  if exists (select 1 from public.orientation_signups where cycle_id = v_day.cycle_id and (guc_id = v_guc or email = v_email)) then
    raise exception 'already_signed_up';
  end if;
  select count(*) into v_count from public.orientation_signups where day_id = p_day_id;
  if v_day.capacity is not null and v_count >= v_day.capacity then
    raise exception 'orientation_full';
  end if;
  insert into public.orientation_signups (cycle_id, day_id, name, guc_id, email, team_ids)
  values (v_day.cycle_id, p_day_id, trim(p_name), v_guc, v_email, p_team_ids);
  return jsonb_build_object('starts_at', v_day.starts_at, 'ends_at', v_day.ends_at, 'location', v_day.location);
end $$;
revoke execute on function public.sign_up_for_orientation(uuid, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.sign_up_for_orientation(uuid, text, text, text, uuid[]) to service_role;
