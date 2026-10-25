-- =====================================================================
-- 0009 · Files and handover library, brand kit
-- Requirements: FR-9.1–FR-9.4
--
-- Scopes:  club → every member (brand kit, templates)
--          division → the division's members
--          team → the team (plus its Curator and the Chairman)
--          board → Chairman, Curators, Executives
-- Upload: create the row first (it reserves storage_path), then upload
-- the file to the "files" bucket at that path.
-- =====================================================================

create type public.file_scope as enum ('club', 'division', 'team', 'board');

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons (id) default private.active_season_id(),
  scope        public.file_scope not null,
  division_id  uuid references public.divisions (id),
  team_id      uuid references public.teams (id),
  folder       text not null default 'General' check (length(trim(folder)) between 1 and 80),
  name         text not null check (length(trim(name)) between 1 and 200),
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  is_handover  boolean not null default false,
  uploaded_by  uuid not null default auth.uid() references public.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((scope = 'team') = (team_id is not null)),
  check ((scope = 'division') = (division_id is not null)),
  check (storage_path ~ '^[0-9a-f-]{36}/[^/]+$')
);
create index files_scope_idx on public.files (season_id, scope, team_id, division_id, folder);
create trigger files_touch before update on public.files
  for each row execute function private.touch_updated_at();
create trigger files_audit after insert or delete on public.files
  for each row execute function private.audit();

create function private.can_see_file(
  p_scope public.file_scope, p_division uuid, p_team uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_scope
    when 'club' then private.has_any_membership(p_uid)
    when 'board' then private.my_role(p_uid) in ('chairman', 'curator', 'executive')
    when 'division' then private.can_manage_division(p_division, p_uid)
         or exists (select 1 from private.membership_of(p_uid) m where m.division_id = p_division)
    when 'team' then private.can_see_team(p_team, p_uid)
  end
$$;

create function private.can_write_file(
  p_scope public.file_scope, p_division uuid, p_team uuid, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_scope
    when 'club' then private.my_role(p_uid) in ('chairman', 'curator')
    when 'board' then private.my_role(p_uid) in ('chairman', 'curator')
    when 'division' then private.can_manage_division(p_division, p_uid)
    when 'team' then private.can_manage_team(p_team, p_uid)
  end
$$;

create function private.file_access(p_path text, p_write boolean, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.storage_path = p_path
      and case when p_write then private.can_write_file(f.scope, f.division_id, f.team_id, p_uid)
               else private.can_see_file(f.scope, f.division_id, f.team_id, p_uid) end)
$$;

alter table public.files enable row level security;
create policy "Members read files in scope" on public.files for select to authenticated
  using (private.can_see_file(scope, division_id, team_id));
create policy "Managers add files" on public.files for insert to authenticated
  with check (uploaded_by = (select auth.uid())
              and season_id = (select private.active_season_id())
              and private.can_write_file(scope, division_id, team_id)
              and storage_path like id::text || '/%');
create policy "Managers edit files" on public.files for update to authenticated
  using (private.can_write_file(scope, division_id, team_id))
  with check (private.can_write_file(scope, division_id, team_id));
create policy "Managers remove files" on public.files for delete to authenticated
  using (private.can_write_file(scope, division_id, team_id));
revoke update on public.files from anon, authenticated;
grant update (folder, name, is_handover) on public.files to authenticated;
revoke all on public.files from anon;

insert into storage.buckets (id, name, public) values ('files', 'files', false)
on conflict (id) do nothing;
create policy "Read library files in scope" on storage.objects for select to authenticated
  using (bucket_id = 'files' and private.file_access(name, false));
create policy "Upload library files to reserved paths" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and private.file_access(name, true));
create policy "Delete library files" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and private.file_access(name, true));

-- Handover check before rollover (FR-9.4): every Executive and Curator
-- of the active season, and whether they have uploaded a handover file.
create function public.handover_status()
returns table (user_id uuid, name text, role public.member_role, division text, team text,
               handover_files bigint, last_upload timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.name, m.role, d.name, t.name,
           count(f.id), max(f.created_at)
    from public.memberships m
    join public.seasons s on s.id = m.season_id and s.is_active
    join public.users u on u.id = m.user_id
    left join public.divisions d on d.id = m.division_id
    left join public.teams t on t.id = m.team_id
    left join public.files f on f.season_id = s.id and f.is_handover and f.uploaded_by = m.user_id
    where m.status = 'active' and m.role in ('curator', 'executive')
    group by m.user_id, u.name, m.role, d.name, t.name
    order by count(f.id), d.name, t.name, u.name;
end $$;
revoke execute on function public.handover_status() from public, anon;
