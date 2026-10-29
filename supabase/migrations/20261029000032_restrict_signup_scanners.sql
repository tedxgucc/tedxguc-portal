-- Signup pickups require explicit assignment except for the named leadership roles.
create or replace function private.can_scan_pickups(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role in ('chairman', 'curator')
       or (m.role = 'executive' and m.team_kind = 'logistics_planning')
       or exists (select 1 from public.pickup_scanners s
                  where s.user_id = p_uid and s.season_id = private.active_season_id())
  )
$$;

drop policy "Sign-up managers assign pickup scanners" on public.pickup_scanners;
create policy "Pickup leaders assign scanners" on public.pickup_scanners for all to authenticated
  using (season_id = private.active_season_id() and (
    private.is_chairman() or exists (select 1 from private.membership_of(auth.uid()) m
      where m.role = 'curator' or (m.role = 'executive' and m.team_kind = 'logistics_planning'))))
  with check (season_id = private.active_season_id() and (
    private.is_chairman() or exists (select 1 from private.membership_of(auth.uid()) m
      where m.role = 'curator' or (m.role = 'executive' and m.team_kind = 'logistics_planning'))));
