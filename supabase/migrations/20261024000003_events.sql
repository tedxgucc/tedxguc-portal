-- =====================================================================
-- 0003 · Events, guest registration, waitlist, tickets, check-in
--        (online and offline), run of show.
-- Requirements: FR-1.8, FR-2.2, FR-2.7, FR-5.1–FR-5.8
--
-- Guests have no accounts. Registering, cancelling and re-sending a
-- ticket go through the public-forms server function (spam check +
-- email), which calls the service-only functions below.
-- =====================================================================

create type public.event_type as enum ('main_event', 'salon', 'workshop', 'other');
create type public.event_status as enum ('draft', 'published', 'completed', 'cancelled');
create type public.license_status as enum ('pending', 'licensed', 'not_required');
create type public.registration_status as enum ('registered', 'waitlisted', 'cancelled');
create type public.guest_type as enum ('attendee', 'vip', 'faculty', 'alumni', 'press');

create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  season_id              uuid not null references public.seasons (id) default private.active_season_id(),
  type                   public.event_type not null,
  title                  text not null,
  slug                   text unique check (slug ~ '^[a-z0-9-]+$'),
  description            text,
  agenda                 jsonb not null default '[]',
  starts_at              timestamptz not null,
  ends_at                timestamptz,
  venue                  text,
  capacity               int check (capacity > 0),
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  license_status         public.license_status not null default 'pending',
  is_public              boolean not null default true,
  status                 public.event_status not null default 'draft',
  ticket_prefix          text not null default 'TX' check (ticket_prefix ~ '^[A-Z0-9]{1,10}$'),
  next_ticket_no         int not null default 1,
  created_by             uuid references public.users (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check (registration_closes_at is null or registration_opens_at is null
         or registration_closes_at > registration_opens_at),
  -- TEDx events can't go public until licensed (FR-1.8).
  check (type not in ('main_event', 'salon') or license_status <> 'not_required')
);
create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();
create trigger events_audit after insert or update or delete on public.events
  for each row execute function private.audit();

alter table public.speakers
  add constraint speakers_event_fk foreign key (event_id) references public.events (id) on delete set null;

-- Custom registration questions (FR-5.2).
create table public.event_fields (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  position   int not null default 0,
  label      text not null,
  kind       text not null default 'text' check (kind in ('text', 'textarea', 'select', 'checkbox', 'number')),
  required   boolean not null default false,
  options    jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id),
  guest_name         text not null,
  guest_email        text not null check (guest_email = lower(guest_email)),
  guest_phone        text,
  guest_type         public.guest_type not null default 'attendee',
  answers            jsonb not null default '{}',
  status             public.registration_status not null,
  ticket_no          text,
  -- The QR holds ticket_code. Check-in looks tickets up by its hash, and
  -- offline devices only ever download hashes.
  ticket_code        text unique,
  ticket_code_hash   text unique,
  status_token_hash  text not null unique,
  consent_at         timestamptz not null,
  checked_in_at      timestamptz,
  checked_in_by      uuid references public.users (id),
  checked_in_offline boolean not null default false,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((status = 'registered') = (ticket_code is not null) or status = 'cancelled')
);
create unique index registrations_one_per_email on public.registrations (event_id, guest_email)
  where status <> 'cancelled';
create index registrations_waitlist_idx on public.registrations (event_id, created_at) where status = 'waitlisted';
create trigger registrations_touch before update on public.registrations
  for each row execute function private.touch_updated_at();

-- Members allowed to scan tickets for one event (FR-5.4).
create table public.event_staff (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  duty       text not null default 'checkin',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, duty)
);

-- Every scan, including rejected ones and offline scans synced later.
create table public.checkin_scans (
  id              bigint generated always as identity primary key,
  event_id        uuid not null references public.events (id) on delete cascade,
  registration_id uuid references public.registrations (id),
  scanned_by      uuid references public.users (id),
  device_id       text,
  scanned_at      timestamptz not null,
  synced_at       timestamptz not null default now(),
  offline         boolean not null default false,
  result          text not null
);
create index checkin_scans_event_idx on public.checkin_scans (event_id, scanned_at);

-- Event-day timeline (FR-5.5), run by Logistics and Planning.
create table public.run_of_show (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  position   int not null default 0,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  item       text not null,
  owner_id   uuid references public.users (id),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger run_of_show_touch before update on public.run_of_show
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------

-- Chairman or Operations Curator.
create function private.can_manage_events(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
$$;

-- Event managers, Operations members, any Executive, and assigned staff.
create function private.can_check_in(p_event uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_events(p_uid)
      or private.in_division_kind('operations', p_uid)
      or private.my_role(p_uid) = 'executive'
      or (private.is_member(p_uid) and exists (
            select 1 from public.event_staff s
            where s.event_id = p_event and s.user_id = p_uid and s.duty = 'checkin'))
$$;

create function private.can_edit_run_of_show(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_events(p_uid)
      or private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid)
$$;

create function private.event_is_listed(p_event public.events) returns boolean
language sql stable set search_path = '' as $$
  select p_event.is_public
     and p_event.status in ('published', 'completed')
     and p_event.license_status in ('licensed', 'not_required')
$$;

create function private.event_is_open(p_event public.events) returns boolean
language sql stable set search_path = '' as $$
  select private.event_is_listed(p_event)
     and p_event.status = 'published'
     and (p_event.registration_opens_at is null or now() >= p_event.registration_opens_at)
     and now() < coalesce(p_event.registration_closes_at, p_event.starts_at)
$$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_fields enable row level security;
alter table public.registrations enable row level security;
alter table public.event_staff enable row level security;
alter table public.checkin_scans enable row level security;
alter table public.run_of_show enable row level security;

create policy "Guests read listed events" on public.events for select to anon
  using (private.event_is_listed(events));
create policy "Members read events" on public.events for select to authenticated
  using (private.event_is_listed(events)
         or ((select private.is_member()) and status <> 'draft')
         or (select private.can_manage_events()));
create policy "Operations manages events" on public.events for all to authenticated
  using ((select private.can_manage_events())) with check ((select private.can_manage_events()));
-- The ticket counter only moves inside the registration functions.
revoke update on public.events from anon, authenticated;
grant update (type, title, slug, description, agenda, starts_at, ends_at, venue, capacity,
              registration_opens_at, registration_closes_at, license_status, is_public,
              status, ticket_prefix) on public.events to authenticated;

create policy "Read fields of visible events" on public.event_fields for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "Operations manages fields" on public.event_fields for all to authenticated
  using ((select private.can_manage_events())) with check ((select private.can_manage_events()));

-- Guest data: event managers only. Rows are created and changed through
-- the functions below. Nobody can read ticket codes directly.
create policy "Operations reads registrations" on public.registrations for select to authenticated
  using ((select private.can_manage_events()));
create policy "Operations edits guest details" on public.registrations for update to authenticated
  using ((select private.can_manage_events())) with check ((select private.can_manage_events()));
revoke all on public.registrations from anon, authenticated;
grant select (id, event_id, guest_name, guest_email, guest_phone, guest_type, answers, status,
              ticket_no, consent_at, checked_in_at, checked_in_by, checked_in_offline,
              cancelled_at, created_at, updated_at) on public.registrations to authenticated;
grant update (guest_name, guest_phone, guest_type) on public.registrations to authenticated;

create policy "Members read event staff" on public.event_staff for select to authenticated
  using ((select private.is_member()));
create policy "Operations assigns staff" on public.event_staff for all to authenticated
  using ((select private.can_manage_events())) with check ((select private.can_manage_events()));

create policy "Operations reads scan log" on public.checkin_scans for select to authenticated
  using ((select private.can_manage_events()));
revoke insert, update, delete on public.checkin_scans from anon, authenticated;

create policy "Members read run of show" on public.run_of_show for select to authenticated
  using ((select private.is_member()));
create policy "L&P edits run of show" on public.run_of_show for all to authenticated
  using ((select private.can_edit_run_of_show())) with check ((select private.can_edit_run_of_show()));

-- ---------------------------------------------------------------------
-- Tickets and waitlist
-- ---------------------------------------------------------------------

-- Next ticket number for an event, e.g. MAIN27-0042. The caller must
-- already hold the event row lock.
create function private.next_ticket_no(p_event_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_no int;
begin
  update public.events
     set next_ticket_no = next_ticket_no + 1
   where id = p_event_id
  returning ticket_prefix, next_ticket_no - 1 into v_prefix, v_no;
  return v_prefix || '-' || lpad(v_no::text, 4, '0');
end $$;

-- Promote the earliest waitlisted guest if a seat is free. Returns the
-- details the server function needs to email their ticket, or null.
create function private.promote_next(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_taken int;
  v_reg public.registrations;
  v_code text := private.new_token(false);
  v_ticket text;
begin
  select * into v_event from public.events where id = p_event_id for update;
  select count(*) into v_taken from public.registrations where event_id = p_event_id and status = 'registered';
  if v_event.capacity is not null and v_taken >= v_event.capacity then
    return null;
  end if;

  select * into v_reg from public.registrations
  where event_id = p_event_id and status = 'waitlisted'
  order by created_at, id
  limit 1
  for update;
  if not found then
    return null;
  end if;

  v_ticket := private.next_ticket_no(p_event_id);
  update public.registrations
     set status = 'registered', ticket_no = v_ticket,
         ticket_code = v_code, ticket_code_hash = private.hash_token(v_code)
   where id = v_reg.id;

  return jsonb_build_object(
    'registration_id', v_reg.id, 'guest_name', v_reg.guest_name, 'guest_email', v_reg.guest_email,
    'ticket_no', v_ticket, 'ticket_code', v_code,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;

-- Register a guest (FR-5.2, FR-5.3). Service role only.
-- Returns the plain ticket code and status token once, for the email.
create function public.register_for_event(
  p_event_id   uuid,
  p_name       text,
  p_email      text,
  p_phone      text default null,
  p_answers    jsonb default '{}',
  p_guest_type public.guest_type default 'attendee'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_event  public.events;
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_name   text := trim(coalesce(p_name, ''));
  v_taken  int;
  v_status public.registration_status;
  v_ticket text;
  v_code   text;
  v_token  text := private.new_token();
  v_id     uuid;
  v_field  record;
  v_position int;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not private.event_is_open(v_event) then
    raise exception 'event_not_open';
  end if;
  if v_name = '' or length(v_name) > 120 then
    raise exception 'invalid_name';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  for v_field in select id from public.event_fields where event_id = p_event_id and required loop
    if coalesce(trim(p_answers ->> v_field.id::text), '') = '' then
      raise exception 'missing_field:%', v_field.id;
    end if;
  end loop;
  if exists (select 1 from public.registrations
             where event_id = p_event_id and guest_email = v_email and status <> 'cancelled') then
    raise exception 'already_registered';
  end if;

  select count(*) into v_taken from public.registrations where event_id = p_event_id and status = 'registered';
  if v_event.capacity is null or v_taken < v_event.capacity then
    v_status := 'registered';
    v_code := private.new_token(false);
    v_ticket := private.next_ticket_no(p_event_id);
  else
    v_status := 'waitlisted';
  end if;

  insert into public.registrations (
    event_id, guest_name, guest_email, guest_phone, guest_type, answers, status,
    ticket_no, ticket_code, ticket_code_hash, status_token_hash, consent_at)
  values (
    p_event_id, v_name, v_email, nullif(trim(p_phone), ''), p_guest_type, coalesce(p_answers, '{}'), v_status,
    v_ticket, v_code, case when v_code is not null then private.hash_token(v_code) end,
    private.hash_token(v_token), now())
  returning id into v_id;

  if v_status = 'waitlisted' then
    select count(*) into v_position from public.registrations
    where event_id = p_event_id and status = 'waitlisted';
  end if;

  return jsonb_build_object(
    'registration_id', v_id, 'status', v_status, 'ticket_no', v_ticket, 'ticket_code', v_code,
    'status_token', v_token, 'waitlist_position', v_position,
    'guest_name', v_name, 'guest_email', v_email,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;

-- What a guest sees on their private status page (FR-2.2).
-- Safe for anyone to call: it needs the unguessable status token.
create function public.get_registration_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'registration_id', r.id, 'status', r.status, 'guest_name', r.guest_name,
    'ticket_no', r.ticket_no,
    'ticket_code', case when r.status = 'registered' then r.ticket_code end,
    'checked_in_at', r.checked_in_at,
    'waitlist_position', case when r.status = 'waitlisted' then (
        select count(*) from public.registrations w
        where w.event_id = r.event_id and w.status = 'waitlisted'
          and (w.created_at, w.id) <= (r.created_at, r.id)) end,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at,
                                'ends_at', e.ends_at, 'venue', e.venue))
  from public.registrations r
  join public.events e on e.id = r.event_id
  where r.status_token_hash = private.hash_token(p_status_token)
$$;

-- Guest cancels from their status link; frees a seat for the waitlist.
-- Service role only (the server function emails the promoted guest).
create function public.cancel_registration(p_status_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations
  where status_token_hash = private.hash_token(p_status_token);
  if not found then
    raise exception 'not_found';
  end if;
  return private.cancel_registration_row(v_reg.id);
end $$;

-- Event managers cancel a registration from the portal.
create function public.admin_cancel_registration(p_registration_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_events() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return private.cancel_registration_row(p_registration_id);
end $$;

create function private.cancel_registration_row(p_registration_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_was_registered boolean;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'not_found';
  end if;
  -- Lock the event first, the same order registration uses.
  perform 1 from public.events where id = v_reg.event_id for update;
  select * into v_reg from public.registrations where id = p_registration_id for update;

  if v_reg.status = 'cancelled' then
    raise exception 'already_cancelled';
  end if;
  if v_reg.checked_in_at is not null then
    raise exception 'already_checked_in';
  end if;

  v_was_registered := v_reg.status = 'registered';
  update public.registrations set status = 'cancelled', cancelled_at = now() where id = v_reg.id;

  return jsonb_build_object(
    'cancelled_id', v_reg.id,
    'event_id', v_reg.event_id,
    'promoted', case when v_was_registered then private.promote_next(v_reg.event_id) end);
end $$;

-- After raising capacity, fill the new seats from the waitlist.
-- Returns everyone promoted so the server function can email them.
create function public.promote_waitlist(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_out jsonb := '[]';
  v_one jsonb;
begin
  if not (private.can_manage_events() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  loop
    v_one := private.promote_next(p_event_id);
    exit when v_one is null;
    v_out := v_out || jsonb_build_array(v_one);
  end loop;
  return v_out;
end $$;

-- "Resend my ticket": issues a fresh status link for an email's
-- registration. Service role only; the link is emailed to the address
-- on record, never shown to the requester.
create function public.reissue_status_link(p_event_id uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_event public.events;
  v_token text := private.new_token();
begin
  select * into v_reg from public.registrations
  where event_id = p_event_id and guest_email = lower(trim(p_email)) and status <> 'cancelled'
  for update;
  if not found then
    return null;
  end if;
  select * into v_event from public.events where id = p_event_id;
  update public.registrations set status_token_hash = private.hash_token(v_token) where id = v_reg.id;
  return jsonb_build_object(
    'registration_id', v_reg.id, 'status', v_reg.status, 'guest_name', v_reg.guest_name,
    'guest_email', v_reg.guest_email, 'ticket_no', v_reg.ticket_no, 'ticket_code', v_reg.ticket_code,
    'status_token', v_token,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;

-- ---------------------------------------------------------------------
-- Check-in (FR-5.4, FR-5.7, FR-5.8)
-- Results: ok · already_checked_in · not_found · cancelled · waitlisted
-- ---------------------------------------------------------------------
create function private.apply_check_in(
  p_event_id uuid, p_reg public.registrations, p_at timestamptz, p_offline boolean, p_device text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result text;
  v_checked_at timestamptz;
begin
  if p_reg.id is null then
    v_result := 'not_found';
  elsif p_reg.status = 'cancelled' then
    v_result := 'cancelled';
  elsif p_reg.status = 'waitlisted' then
    v_result := 'waitlisted';
  else
    -- The "is null" condition makes double entry impossible, even when
    -- two phones scan the same ticket at the same moment.
    update public.registrations
       set checked_in_at = p_at, checked_in_by = auth.uid(), checked_in_offline = p_offline
     where id = p_reg.id and checked_in_at is null
    returning checked_in_at into v_checked_at;
    if found then
      v_result := 'ok';
    else
      v_result := 'already_checked_in';
      select checked_in_at into v_checked_at from public.registrations where id = p_reg.id;
    end if;
  end if;

  insert into public.checkin_scans (event_id, registration_id, scanned_by, device_id, scanned_at, offline, result)
  values (p_event_id, p_reg.id, auth.uid(), p_device, p_at, p_offline, v_result);

  return jsonb_build_object(
    'result', v_result,
    'registration_id', p_reg.id,
    'guest_name', p_reg.guest_name,
    'guest_type', p_reg.guest_type,
    'ticket_no', p_reg.ticket_no,
    'checked_in_at', v_checked_at);
end $$;

-- Scan a ticket QR while online.
create function public.check_in(p_event_id uuid, p_ticket_code text, p_device_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_reg from public.registrations
  where event_id = p_event_id and ticket_code_hash = private.hash_token(trim(p_ticket_code));
  return private.apply_check_in(p_event_id, v_reg, now(), false, p_device_id);
end $$;

-- Manual check-in after a name/email/ticket search (FR-5.8).
create function public.check_in_registration(p_registration_id uuid, p_device_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found or not private.can_check_in(v_reg.event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return private.apply_check_in(v_reg.event_id, v_reg, now(), false, p_device_id);
end $$;

-- Search by name, email or ticket number. Emails are masked because
-- scanners include Associates.
create function public.search_registrations(p_event_id uuid, p_query text)
returns table (registration_id uuid, guest_name text, email_hint text, ticket_no text,
               guest_type public.guest_type, status public.registration_status, checked_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(v_q) < 2 then
    return;
  end if;
  return query
    select r.id, r.guest_name,
           left(r.guest_email, 2) || '***@' || split_part(r.guest_email, '@', 2),
           r.ticket_no, r.guest_type, r.status, r.checked_in_at
    from public.registrations r
    where r.event_id = p_event_id and r.status <> 'cancelled'
      and (lower(r.guest_name) like '%' || v_q || '%'
           or r.guest_email = v_q
           or lower(coalesce(r.ticket_no, '')) = v_q)
    order by r.guest_name
    limit 20;
end $$;

-- Ticket list for offline scanning, downloaded before doors open.
-- Holds hashes only, so a lost phone can't be used to forge tickets.
create function public.get_checkin_manifest(p_event_id uuid)
returns table (registration_id uuid, ticket_code_hash text, guest_name text, ticket_no text,
               guest_type public.guest_type, checked_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select r.id, r.ticket_code_hash, r.guest_name, r.ticket_no, r.guest_type, r.checked_in_at
    from public.registrations r
    where r.event_id = p_event_id and r.status = 'registered';
end $$;

-- Upload scans made offline (FR-5.7).
-- p_scans: [{"ticket_code": "...", "scanned_at": "2027-03-01T17:02:11Z", "device_id": "door-2"}]
-- Scans are applied oldest first, so the first scan wins; later scans of
-- the same ticket come back as already_checked_in, to show as warnings.
create function public.sync_offline_checkins(p_event_id uuid, p_scans jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_scan record;
  v_reg public.registrations;
  v_out jsonb := '[]';
  v_res jsonb;
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_scans) <> 'array' or jsonb_array_length(p_scans) > 2000 then
    raise exception 'invalid_scans';
  end if;

  for v_scan in
    select s.value ->> 'ticket_code' as code,
           least(coalesce((s.value ->> 'scanned_at')::timestamptz, now()), now()) as at,
           s.value ->> 'device_id' as device,
           s.ordinality - 1 as idx
    from jsonb_array_elements(p_scans) with ordinality as s (value, ordinality)
    order by 2, 4
  loop
    v_reg := null;
    select * into v_reg from public.registrations
    where event_id = p_event_id and ticket_code_hash = private.hash_token(trim(coalesce(v_scan.code, '')));
    v_res := private.apply_check_in(p_event_id, v_reg, v_scan.at, true, v_scan.device);
    v_out := v_out || jsonb_build_array(v_res || jsonb_build_object('index', v_scan.idx));
  end loop;
  return v_out;
end $$;

-- Live counts for the check-in screen and dashboards.
create function public.event_stats(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.can_check_in(p_event_id) or private.can_manage_events()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'capacity', e.capacity,
      'registered', count(*) filter (where r.status = 'registered'),
      'waitlisted', count(*) filter (where r.status = 'waitlisted'),
      'cancelled', count(*) filter (where r.status = 'cancelled'),
      'checked_in', count(*) filter (where r.checked_in_at is not null))
    from public.events e
    left join public.registrations r on r.event_id = e.id
    where e.id = p_event_id
    group by e.id);
end $$;

-- Service-role-only functions: guests reach them through the server
-- function, never directly.
revoke execute on function public.register_for_event(uuid, text, text, text, jsonb, public.guest_type) from public, anon, authenticated;
revoke execute on function public.cancel_registration(text) from public, anon, authenticated;
revoke execute on function public.reissue_status_link(uuid, text) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, text, text, text, jsonb, public.guest_type) to service_role;
grant execute on function public.cancel_registration(text) to service_role;
grant execute on function public.reissue_status_link(uuid, text) to service_role;

-- Member-only functions: check permissions inside, but anon has no business calling them.
revoke execute on function public.admin_cancel_registration(uuid) from public, anon;
revoke execute on function public.promote_waitlist(uuid) from public, anon;
revoke execute on function public.check_in(uuid, text, text) from public, anon;
revoke execute on function public.check_in_registration(uuid, text) from public, anon;
revoke execute on function public.search_registrations(uuid, text) from public, anon;
revoke execute on function public.get_checkin_manifest(uuid) from public, anon;
revoke execute on function public.sync_offline_checkins(uuid, jsonb) from public, anon;
revoke execute on function public.event_stats(uuid) from public, anon;
