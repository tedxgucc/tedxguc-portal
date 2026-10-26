-- Calendar feeds, meeting lists and direct meeting reads share this helper.
-- No scope: board = high board; all other meetings = general club meetings.
-- Division-scoped board meetings include that division's Executives.
create or replace function private.can_see_meeting(
  p_type public.meeting_type, p_team uuid, p_division uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman'
       or case
         when p_team is not null then private.can_see_team(p_team, p_uid)
           and (p_type <> 'board_meeting' or m.role in ('curator', 'executive'))
         when p_division is not null then m.role in ('curator', 'executive') and m.division_id = p_division
         when p_type = 'board_meeting' then m.role = 'curator'
         else true
       end
  )
$$;

-- Notifications, attendance and QR eligibility must not include people who
-- cannot see the meeting (notably Executives at a high-board meeting).
-- This also works before migration 21: can_see_team uses the installed model.
create or replace function private.meeting_expected(p_meeting uuid)
returns table (user_id uuid, role public.member_role, team_id uuid, division_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, coalesce(mt.team_id, m.team_id),
         coalesce(mt.division_id, private.team_division(mt.team_id), m.division_id)
  from public.meetings mt
  join public.memberships m on m.season_id = mt.season_id and m.status = 'active'
  where mt.id = p_meeting
    and case when mt.type = 'board_meeting' then m.role in ('executive', 'curator') else m.role = 'associate' end
    and private.can_see_meeting(mt.type, mt.team_id, mt.division_id, m.user_id)
$$;
