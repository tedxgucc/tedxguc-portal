-- Deleting a round also deletes all of its applicants and recruitment records.
-- One transaction: a failure rolls back the complete deletion.
-- Accepted members' accounts, memberships and invites are kept.
create or replace function public.delete_recruitment_cycle(p_cycle_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.is_chairman(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.recruitment_cycles where id = p_cycle_id for update;
  if not found then raise exception 'not_found'; end if;

  delete from public.interview_slots where cycle_id = p_cycle_id;
  -- Scores, duplicate keys and referrals cascade from applications.
  delete from public.applications where cycle_id = p_cycle_id;
  delete from public.board_plans where cycle_id = p_cycle_id;
  -- Roles and availability cascade from the cycle.
  delete from public.recruitment_cycles where id = p_cycle_id;
end $$;
revoke all on function public.delete_recruitment_cycle(uuid) from public, anon;
grant execute on function public.delete_recruitment_cycle(uuid) to authenticated;
