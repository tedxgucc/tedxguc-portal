-- =====================================================================
-- 0002 · Public site content: editable sections (About, FAQ, …),
--        speaker cards, partner logo wall, inquiry/contact messages.
-- Requirements: FR-1.2–FR-1.7, FR-1.10, FR-10.3 (publish toggle)
-- The full speaker pipeline (FR-10) and partner CRM (FR-11) build on
-- these tables in Phase 3.
-- =====================================================================

-- Editable page sections. owner_kind lets a Curator edit their own
-- division's section ("Edit content of own area" in the matrix).
create table public.site_sections (
  key          text primary key check (key ~ '^[a-z0-9_-]+$'),
  owner_kind   public.division_kind,
  title        text not null,
  body         jsonb not null default '{}',
  is_published boolean not null default false,
  updated_by   uuid references public.users (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger site_sections_touch before update on public.site_sections
  for each row execute function private.touch_updated_at();

create function private.can_edit_section(p_owner public.division_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_chairman(p_uid)
      or (p_owner is not null and exists (
            select 1 from private.membership_of(p_uid) m
            where m.role = 'curator' and m.division_kind = p_owner))
$$;

alter table public.site_sections enable row level security;
create policy "Anyone reads published sections" on public.site_sections for select to anon, authenticated
  using (is_published or (select private.is_member()));
create policy "Chairman creates sections" on public.site_sections for insert to authenticated
  with check ((select private.is_chairman()));
create policy "Owners edit sections" on public.site_sections for update to authenticated
  using (private.can_edit_section(owner_kind)) with check (private.can_edit_section(owner_kind));
create policy "Chairman deletes sections" on public.site_sections for delete to authenticated
  using ((select private.is_chairman()));
-- Only the Chairman reassigns ownership: Curators can't change owner_kind.
revoke update on public.site_sections from anon, authenticated;
grant update (title, body, is_published, updated_by) on public.site_sections to authenticated;

-- Speaker cards (FR-1.4). Talks division manages them.
create table public.speakers (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) default private.active_season_id(),
  event_id    uuid,  -- FK added in 0003 once events exists
  name        text not null,
  bio         text,
  photo_url   text,
  talk_title  text,
  talk_url    text,
  is_public   boolean not null default false,
  created_by  uuid references public.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger speakers_touch before update on public.speakers
  for each row execute function private.touch_updated_at();

-- Chairman, Talks Curator, Talks Executives.
create function private.can_manage_speakers(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('talks', p_uid)
      or exists (select 1 from private.membership_of(p_uid) m
                 where m.division_kind = 'talks' and m.role = 'executive')
$$;

alter table public.speakers enable row level security;
create policy "Anyone reads public speakers" on public.speakers for select to anon, authenticated
  using (is_public or (select private.is_member()));
create policy "Talks manages speakers" on public.speakers for all to authenticated
  using ((select private.can_manage_speakers())) with check ((select private.can_manage_speakers()));

-- Partner logo wall (FR-1.5). Operations (Partnerships) manages it.
create table public.partners (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id) default private.active_season_id(),
  company    text not null,
  tier       text,
  logo_url   text,
  website    text,
  is_public  boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger partners_touch before update on public.partners
  for each row execute function private.touch_updated_at();

-- Chairman, Operations Curator, Partnerships Executives.
create function private.can_manage_partners(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
      or private.in_team_kind('partnerships', array['executive']::public.member_role[], p_uid)
$$;

alter table public.partners enable row level security;
create policy "Anyone reads public partners" on public.partners for select to anon, authenticated
  using (is_public or (select private.is_member()));
create policy "Partnerships manages partners" on public.partners for all to authenticated
  using ((select private.can_manage_partners())) with check ((select private.can_manage_partners()));

-- "Become a partner" and contact form messages (FR-1.5, FR-1.7).
-- Inserted only by the public-forms server function after spam checks.
create table public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('partner', 'contact')),
  name       text not null,
  email      text not null,
  phone      text,
  company    text,
  message    text not null,
  consent_at timestamptz not null,
  status     text not null default 'new' check (status in ('new', 'handled')),
  handled_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;
-- Partner inquiries: Chairman, Operations Curator, Partnerships team.
-- Contact messages: Chairman and Curators.
create policy "Board reads inquiries" on public.inquiries for select to authenticated
  using (
    (kind = 'partner' and ((select private.leads_kind('operations'))
                           or (select private.in_team_kind('partnerships'))))
    or (kind = 'contact' and (select private.my_role()) in ('chairman', 'curator')));
create policy "Board marks inquiries handled" on public.inquiries for update to authenticated
  using (
    (kind = 'partner' and ((select private.leads_kind('operations'))
                           or (select private.in_team_kind('partnerships'))))
    or (kind = 'contact' and (select private.my_role()) in ('chairman', 'curator')));
revoke insert, update, delete on public.inquiries from anon, authenticated;
grant update (status, handled_by) on public.inquiries to authenticated;
