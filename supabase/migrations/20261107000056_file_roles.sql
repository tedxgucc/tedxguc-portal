-- Files can be limited to certain roles inside their place (club, board,
-- division, team). Empty/null roles = everyone who can see that place.
-- The uploader, the Chairman and whoever manages that place always see it.
alter table public.files add column roles public.member_role[]
  check (roles is null or cardinality(roles) > 0);
grant update (roles) on public.files to authenticated;

create function private.can_see_file_row(
  p_scope public.file_scope, p_division uuid, p_team uuid, p_roles public.member_role[], p_uploader uuid,
  p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_see_file(p_scope, p_division, p_team, p_uid) and (
    p_roles is null
    or p_uploader = p_uid
    or private.my_role(p_uid) = 'chairman'
    or private.my_role(p_uid) = any (p_roles)
    or private.can_write_file(p_scope, p_division, p_team, p_uid))
$$;

drop policy "Members read files in scope" on public.files;
create policy "Members read files in scope" on public.files for select to authenticated
  using (private.can_see_file_row(scope, division_id, team_id, roles, uploaded_by));

create or replace function private.file_access(p_path text, p_write boolean, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.storage_path = p_path
      and case when p_write then private.can_write_file(f.scope, f.division_id, f.team_id, p_uid)
               else private.can_see_file_row(f.scope, f.division_id, f.team_id, f.roles, f.uploaded_by, p_uid) end)
$$;
