-- =====================================================================
-- 0065 · Invite chain: each level adds the level below it.
--   Chairman  → Curators (and anyone, as a backup when a role is empty)
--   Curator   → Executives of teams in their own division
--   Executive → Associates of their own team
-- Associates accepted through recruitment still join automatically.
-- =====================================================================

create or replace function private.can_invite_to(
  p_role public.member_role, p_division uuid, p_team uuid, p_season uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_chairman(p_uid)
      or (p_season = private.active_season_id() and exists (
            select 1 from private.membership_of(p_uid) m
            where (m.role = 'curator' and p_role = 'executive'
                   and p_team is not null and private.team_division(p_team) = m.division_id)
               or (m.role = 'executive' and p_role = 'associate'
                   and p_team is not null and m.team_id = p_team)))
$$;

drop policy if exists "Chairman and Curators invite" on public.invites;
create policy "Each level invites the level below" on public.invites for insert to authenticated
  with check (invited_by = (select auth.uid())
              and private.can_invite_to(role, division_id, team_id, season_id));

-- Executives now see (and can revoke) the invites for their own team too.
drop policy if exists "Board reads invites" on public.invites;
create policy "Board reads invites" on public.invites for select to authenticated
  using (invited_by = (select auth.uid())
         or (select private.is_chairman())
         or (division_id is not null and private.can_manage_division(division_id))
         or (team_id is not null and private.can_manage_team(team_id)));

-- Old helper kept for anything that still calls it, now following the chain.
create or replace function private.can_invite(
  p_role public.member_role, p_division uuid, p_season uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_chairman(p_uid)
      or (p_role = 'executive' and p_season = private.active_season_id()
          and exists (select 1 from private.membership_of(p_uid) m where m.role = 'curator' and m.division_id = p_division))
$$;

-- "Set your password" (claiming an invited account without email proof) is retired:
-- members now set their password from the link in their invite email.
revoke execute on function public.invited_account_to_claim(text) from service_role;

-- Forgot password: does this email have a portal account? (Server only; the page
-- always shows the same message so nobody can test which emails exist.)
create function public.account_id_for_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke execute on function public.account_id_for_email(text) from public, anon, authenticated;
grant execute on function public.account_id_for_email(text) to service_role;
