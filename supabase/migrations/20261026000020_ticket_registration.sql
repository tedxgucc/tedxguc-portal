-- Main Event Registration PDF: require the applicable ID number, contact
-- details, guest category and referral source. No ID-front photo is collected.
-- Keep the original category in answers; ticket tiers are Regular or VIP.
update public.registrations set guest_type = 'vip' where guest_type <> 'attendee';

create function private.validate_ticket_registration() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_answers jsonb := new.answers;
  v_category text;
  v_phone text := trim(coalesce(new.guest_phone, ''));
begin
  -- Existing registrations may predate the PDF form. Their operational
  -- updates must still work, without inventing missing identity answers.
  if tg_op = 'UPDATE' and not (new.answers ? 'guest_category') then
    if new.guest_type <> 'attendee' then new.guest_type := 'vip'; end if;
    return new;
  end if;
  if jsonb_typeof(v_answers) is distinct from 'object' then raise exception 'invalid_registration_answers'; end if;
  if (select count(*) from jsonb_each(v_answers)) > 100 or exists (
    select 1 from jsonb_each(v_answers) a where jsonb_typeof(a.value) <> 'string' or length(a.value #>> '{}') > 4000
  ) then raise exception 'invalid_registration_answers'; end if;
  select coalesce(jsonb_object_agg(key, trim(value)), '{}') into v_answers from jsonb_each_text(v_answers);
  if v_phone !~ '^[+0-9 ().-]+$' or length(v_phone) > 30
     or regexp_replace(v_phone, '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  if coalesce(v_answers ->> 'gucian', '') not in ('Yes', 'No') then raise exception 'missing_gucian'; end if;
  if v_answers ->> 'gucian' = 'Yes' then
    if coalesce(v_answers ->> 'guc_id', '') = '' or length(v_answers ->> 'guc_id') > 50 then raise exception 'missing_guc_id'; end if;
    v_answers := v_answers - 'national_id';
  else
    if coalesce(v_answers ->> 'national_id', '') = '' or length(v_answers ->> 'national_id') > 50 then raise exception 'missing_national_id'; end if;
    v_answers := v_answers - 'guc_id';
  end if;
  v_category := v_answers ->> 'guest_category';
  if coalesce(v_category, '') not in ('Attendee', 'Speaker''s Family', 'Ex-Board', 'Board Member Family', 'Sponsor') then raise exception 'invalid_guest_category'; end if;
  if coalesce(v_answers ->> 'referral_source', '') not in ('University', 'TEDxGUC Instagram', 'Speaker''s Platforms', 'Other') then raise exception 'missing_referral_source'; end if;
  if v_answers ->> 'referral_source' = 'Other' then
    if coalesce(v_answers ->> 'referral_other', '') = '' or length(v_answers ->> 'referral_other') > 500 then raise exception 'missing_referral_other'; end if;
  else
    v_answers := v_answers - 'referral_other';
  end if;
  new.answers := v_answers;
  new.guest_phone := v_phone;
  new.guest_type := case when v_category = 'Attendee' then 'attendee'::public.guest_type else 'vip'::public.guest_type end;
  return new;
end $$;

create trigger registrations_validate_form before insert or update of answers, guest_type, guest_phone on public.registrations
  for each row execute function private.validate_ticket_registration();

-- The existing RLS policy restricts registration details to event managers.
grant select (answers) on public.registrations to authenticated;


-- Carry the ticket tier through initial tickets, private views, resends and waitlist promotion.
create or replace function public.register_for_event(
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
    'guest_type', case when p_answers ->> 'guest_category' = 'Attendee' then 'attendee' else 'vip' end,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;

create or replace function public.get_registration_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'registration_id', r.id, 'status', r.status, 'guest_name', r.guest_name, 'guest_type', r.guest_type,
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

create or replace function public.reissue_status_link(p_event_id uuid, p_email text) returns jsonb
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
    'registration_id', v_reg.id, 'status', v_reg.status, 'guest_name', v_reg.guest_name, 'guest_type', v_reg.guest_type,
    'guest_email', v_reg.guest_email, 'ticket_no', v_reg.ticket_no, 'ticket_code', v_reg.ticket_code,
    'status_token', v_token,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;

create or replace function private.promote_next(p_event_id uuid) returns jsonb
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
    'registration_id', v_reg.id, 'guest_name', v_reg.guest_name, 'guest_type', v_reg.guest_type, 'guest_email', v_reg.guest_email,
    'ticket_no', v_ticket, 'ticket_code', v_code,
    'event_title', v_event.title, 'starts_at', v_event.starts_at, 'venue', v_event.venue);
end $$;
