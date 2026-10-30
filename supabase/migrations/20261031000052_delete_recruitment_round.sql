-- The Chairman manages recruitment rounds. Keep applicant/board-plan records.
create or replace function public.delete_recruitment_cycle(p_cycle_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.is_chairman(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.recruitment_cycles where id = p_cycle_id for update;
  if not found then raise exception 'not_found'; end if;
  delete from public.recruitment_cycles where id = p_cycle_id;
exception when foreign_key_violation then
  raise exception 'round_has_records';
end $$;
revoke all on function public.delete_recruitment_cycle(uuid) from public, anon;
grant execute on function public.delete_recruitment_cycle(uuid) to authenticated;
