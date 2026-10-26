-- X Access loyalty card and sponsor banner (FR-18).
-- Partnerships (and the Chairman and Operations Curator) run it: partners
-- and their perks, cards for holders, redemption log, sponsor banner.
-- Partners need no account: they scan a card's QR, see valid / expired and
-- the holder's first name, and can log a use with their PIN.

create function private.can_manage_xaccess(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
      or private.in_team_kind('partnerships', array['executive']::public.member_role[], p_uid)
$$;

create function private.can_view_xaccess(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_xaccess(p_uid) or private.in_team_kind('partnerships', array['associate']::public.member_role[], p_uid)
$$;

-- ---------------------------------------------------------------------
-- Partners and their perks (also the sponsor banner)
-- ---------------------------------------------------------------------
create table public.xaccess_partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  logo_url      text,
  website       text,
  perk          text not null check (length(trim(perk)) > 0),  -- e.g. "15% off all drinks"
  terms         text,
  expires_on    date,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  pin_hash      text,                                           -- partner's PIN for logging uses
  -- Main sponsor discount banner (FR-18.6, FR-18.7)
  in_banner     boolean not null default false,
  banner_offer  text,                                           -- e.g. "20% OFF"
  promo_code    text,
  banner_starts date,
  banner_ends   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger xaccess_partners_touch before update on public.xaccess_partners
  for each row execute function private.touch_updated_at();
create trigger xaccess_partners_audit after insert or update or delete on public.xaccess_partners
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------
create table public.xaccess_cards (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,                 -- printed on the card: XA-27-0001
  code         text not null unique,                 -- secret in the QR and the card link
  holder_name  text not null check (length(trim(holder_name)) > 0),
  holder_email text,
  user_id      uuid references public.users (id) on delete set null,
  tier         text not null default 'Member',
  expires_on   date not null,
  status       text not null default 'active' check (status in ('active', 'cancelled')),
  issued_by    uuid references public.users (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index xaccess_cards_user_idx on public.xaccess_cards (user_id);
create trigger xaccess_cards_touch before update on public.xaccess_cards
  for each row execute function private.touch_updated_at();
create trigger xaccess_cards_audit after insert or update or delete on public.xaccess_cards
  for each row execute function private.audit();

create table public.xaccess_redemptions (
  id          bigint generated always as identity primary key,
  card_id     uuid not null references public.xaccess_cards (id) on delete cascade,
  partner_id  uuid not null references public.xaccess_partners (id) on delete cascade,
  redeemed_at timestamptz not null default now()
);
create index xaccess_redemptions_partner_idx on public.xaccess_redemptions (partner_id, redeemed_at);

create table public.xaccess_banner_clicks (
  partner_id uuid not null references public.xaccess_partners (id) on delete cascade,
  day        date not null default (now() at time zone 'Africa/Cairo')::date,
  clicks     int not null default 0,
  primary key (partner_id, day)
);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.xaccess_partners enable row level security;
alter table public.xaccess_cards enable row level security;
alter table public.xaccess_redemptions enable row level security;
alter table public.xaccess_banner_clicks enable row level security;

-- Perks page is public: active, unexpired partners. The PIN never leaves the database.
create policy "Anyone reads current perks" on public.xaccess_partners for select to anon, authenticated
  using ((is_active and (expires_on is null or expires_on >= (now() at time zone 'Africa/Cairo')::date))
         or (select private.can_view_xaccess()));
create policy "Partnerships manages partners" on public.xaccess_partners for all to authenticated
  using ((select private.can_manage_xaccess())) with check ((select private.can_manage_xaccess()));
revoke select on public.xaccess_partners from anon, authenticated;
grant select (id, name, logo_url, website, perk, terms, expires_on, is_active, sort_order, in_banner, banner_offer,
              promo_code, banner_starts, banner_ends, created_at, updated_at) on public.xaccess_partners to anon, authenticated;

-- Holders see their own card; Partnerships sees all.
create policy "Holders and Partnerships read cards" on public.xaccess_cards for select to authenticated
  using (user_id = (select auth.uid()) or (select private.can_view_xaccess()));
create policy "Partnerships updates cards" on public.xaccess_cards for update to authenticated
  using ((select private.can_manage_xaccess())) with check ((select private.can_manage_xaccess()));
revoke insert, delete on public.xaccess_cards from anon, authenticated;
revoke update on public.xaccess_cards from anon, authenticated;
grant update (holder_name, holder_email, tier, expires_on, status) on public.xaccess_cards to authenticated;
revoke all on public.xaccess_cards from anon;

create policy "Partnerships reads redemptions" on public.xaccess_redemptions for select to authenticated
  using ((select private.can_view_xaccess()));
revoke insert, update, delete on public.xaccess_redemptions from anon, authenticated;
revoke all on public.xaccess_redemptions from anon;

create policy "Partnerships reads banner clicks" on public.xaccess_banner_clicks for select to authenticated
  using ((select private.can_view_xaccess()));
revoke insert, update, delete on public.xaccess_banner_clicks from anon, authenticated;
revoke all on public.xaccess_banner_clicks from anon;

-- ---------------------------------------------------------------------
-- Issuing cards
-- ---------------------------------------------------------------------
create function private.next_xaccess_number() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_year text := to_char(now() at time zone 'Africa/Cairo', 'YY');
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('xaccess_number'));
  select coalesce(max(split_part(number, '-', 3)::int), 0) + 1 into v_n
  from public.xaccess_cards where number like 'XA-' || v_year || '-%';
  return 'XA-' || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;

create function public.issue_xaccess_card(
  p_name text, p_email text default null, p_user_id uuid default null, p_expires_on date default null, p_tier text default 'Member'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_card public.xaccess_cards;
begin
  if not private.can_manage_xaccess() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'invalid_name'; end if;
  if p_user_id is not null and exists (select 1 from public.xaccess_cards where user_id = p_user_id and status = 'active') then
    raise exception 'already_has_card';
  end if;
  insert into public.xaccess_cards (number, code, holder_name, holder_email, user_id, tier, expires_on)
  values (private.next_xaccess_number(), private.new_token(false), trim(p_name), nullif(lower(trim(p_email)), ''), p_user_id,
          coalesce(nullif(trim(p_tier), ''), 'Member'),
          coalesce(p_expires_on, ((now() at time zone 'Africa/Cairo')::date + interval '1 year')::date))
  returning * into v_card;
  if v_card.user_id is not null then
    perform private.notify(array[v_card.user_id], 'xaccess_card', 'Your X Access card is ready', 'Show it at partner places for discounts.', '/portal/xaccess');
  end if;
  return jsonb_build_object('id', v_card.id, 'number', v_card.number, 'code', v_card.code);
end $$;

-- One card for every active member who doesn't have one yet.
create function public.issue_xaccess_for_members(p_expires_on date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_m record;
  v_n int := 0;
begin
  if not private.can_manage_xaccess() then raise exception 'not_allowed' using errcode = '42501'; end if;
  for v_m in
    select u.id, u.name, u.email from public.memberships m join public.users u on u.id = m.user_id
    where m.season_id = private.active_season_id() and m.status = 'active'
      and not exists (select 1 from public.xaccess_cards c where c.user_id = u.id and c.status = 'active')
    order by u.name
  loop
    perform public.issue_xaccess_card(v_m.name, v_m.email, v_m.id, p_expires_on, 'Member');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- The card page (holder) and the verify page (partners): no sign-in.
-- ---------------------------------------------------------------------
create function private.xaccess_state(c public.xaccess_cards) returns text
language sql stable set search_path = '' as $$
  select case when c.status = 'cancelled' then 'cancelled'
              when c.expires_on < (now() at time zone 'Africa/Cairo')::date then 'expired'
              else 'valid' end
$$;

-- Holder's own card page: the full name is fine, they hold the private link.
create function public.get_xaccess_card(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('number', c.number, 'holder_name', c.holder_name, 'tier', c.tier,
                            'expires_on', c.expires_on, 'status', private.xaccess_state(c))
  from public.xaccess_cards c where c.code = p_code
$$;

-- What a partner sees after scanning: valid / expired and the first name only.
create function public.verify_xaccess(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('status', private.xaccess_state(c), 'first_name', split_part(trim(c.holder_name), ' ', 1),
                               'number', c.number, 'tier', c.tier, 'expires_on', c.expires_on)
     from public.xaccess_cards c where c.code = p_code),
    jsonb_build_object('status', 'not_found'))
$$;

-- A partner logs a use with their PIN (FR-18.4).
create function public.redeem_xaccess(p_code text, p_partner_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_card public.xaccess_cards;
  v_partner public.xaccess_partners;
begin
  -- Errors come back as answers, not exceptions, so the guess counter is kept.
  if not public.hit_rate_limit('xa-pin:' || p_partner_id::text, 20, 3600) then return jsonb_build_object('ok', false, 'error', 'too_many_tries'); end if;
  select * into v_partner from public.xaccess_partners where id = p_partner_id and is_active;
  if not found or v_partner.pin_hash is null or v_partner.pin_hash <> private.hash_token(coalesce(p_pin, '')) then
    return jsonb_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  select * into v_card from public.xaccess_cards where code = p_code;
  if not found then return jsonb_build_object('ok', false, 'error', 'card_not_found'); end if;
  if private.xaccess_state(v_card) <> 'valid' then return jsonb_build_object('ok', false, 'error', 'card_not_valid'); end if;
  insert into public.xaccess_redemptions (card_id, partner_id) values (v_card.id, v_partner.id);
  return jsonb_build_object('ok', true, 'partner', v_partner.name, 'first_name', split_part(trim(v_card.holder_name), ' ', 1));
end $$;

create function public.set_xaccess_pin(p_partner_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_xaccess() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,8}$' then raise exception 'invalid_pin'; end if;
  update public.xaccess_partners set pin_hash = case when p_pin is null then null else private.hash_token(p_pin) end
   where id = p_partner_id;
end $$;

-- Sponsor banner clicks, per sponsor per day (FR-18.7).
create function public.xaccess_banner_click(p_partner_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.xaccess_banner_clicks (partner_id, clicks)
  select id, 1 from public.xaccess_partners where id = p_partner_id and in_banner
  on conflict (partner_id, day) do update set clicks = public.xaccess_banner_clicks.clicks + 1
$$;

revoke execute on function public.issue_xaccess_card(text, text, uuid, date, text) from public, anon;
revoke execute on function public.issue_xaccess_for_members(date) from public, anon;
revoke execute on function public.set_xaccess_pin(uuid, text) from public, anon;
grant execute on function public.issue_xaccess_card(text, text, uuid, date, text) to authenticated;
grant execute on function public.issue_xaccess_for_members(date) to authenticated;
grant execute on function public.set_xaccess_pin(uuid, text) to authenticated;
grant execute on function public.get_xaccess_card(text) to anon, authenticated;
grant execute on function public.verify_xaccess(text) to anon, authenticated;
grant execute on function public.redeem_xaccess(text, uuid, text) to anon, authenticated;
grant execute on function public.xaccess_banner_click(uuid) to anon, authenticated;
