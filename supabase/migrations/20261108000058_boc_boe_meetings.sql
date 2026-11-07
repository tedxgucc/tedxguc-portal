-- Board of Curators (BOC) and Board of Executives (BOE) meetings.
-- BOC: every Curator is expected. BOE: every Executive is expected.
-- The Chairman calls and sees both. (Compared as text so the new enum
-- values can be added in the same migration.)
alter type public.meeting_type add value if not exists 'boc_meeting';
alter type public.meeting_type add value if not exists 'boe_meeting';

create or replace function private.can_see_meeting(
  p_type public.meeting_type, p_team uuid, p_division uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.membership_of(p_uid) m
    where m.role = 'chairman'
       or case
         when p_type::text = 'boc_meeting' then m.role = 'curator'
         when p_type::text = 'boe_meeting' then m.role = 'executive'
         when p_team is not null then private.can_see_team(p_team, p_uid)
           and (p_type <> 'board_meeting' or m.role in ('curator', 'executive'))
         when p_division is not null then m.role in ('curator', 'executive') and m.division_id = p_division
         when p_type = 'board_meeting' then m.role = 'curator'
         else true
       end
  )
$$;

create or replace function private.meeting_expected(p_meeting uuid)
returns table (user_id uuid, role public.member_role, team_id uuid, division_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, coalesce(mt.team_id, m.team_id),
         coalesce(mt.division_id, private.team_division(mt.team_id), m.division_id)
  from public.meetings mt
  join public.memberships m on m.season_id = mt.season_id and m.status = 'active'
  where mt.id = p_meeting
    and case mt.type::text
          when 'board_meeting' then m.role in ('executive', 'curator')
          when 'boc_meeting' then m.role = 'curator'
          when 'boe_meeting' then m.role = 'executive'
          else m.role = 'associate' end
    and private.can_see_meeting(mt.type, mt.team_id, mt.division_id, m.user_id)
$$;

create or replace function private.can_write_meeting(
  p_type public.meeting_type, p_team uuid, p_division uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_type::text in ('boc_meeting', 'boe_meeting') then private.is_chairman(p_uid)
    when p_team is not null then private.can_manage_team(p_team, p_uid)
    when p_division is not null then private.can_manage_division(p_division, p_uid)
    when p_type = 'board_meeting' then private.is_chairman(p_uid)
    else exists (select 1 from private.membership_of(p_uid) m
                 where m.role in ('chairman', 'curator')
                    or (m.role = 'executive' and m.division_kind = 'org_development'))
  end
$$;
