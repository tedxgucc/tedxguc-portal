-- =====================================================================
-- 0010 · Finance (TEDxGUC Cash, merged): cashbook, expense requests,
--        division budgets, sponsorships, reconciliation.
-- Requirements: FR-12.1–FR-12.11, FR-3.4 (balances carry over)
--
-- Who sees what:
--   Chairman + Operations Curator ("finance admins"): everything, plus balances
--   L&P Executives: cash outs (with fatoras, expense forms, memos)
--   Partnerships Executives: bank deposits and sponsorships
--   Other Curators: their division's budget vs spent; they approve its requests
--   Everyone: submit an expense request and follow it
-- Money is never deleted: entries are voided with a reason; all changes
-- are in the audit log.
-- =====================================================================

create type public.txn_kind as enum ('cash_out', 'bank_deposit', 'sponsorship', 'package_sale', 'refund', 'opening_balance');
create type public.pay_method as enum ('cash', 'bank', 'instapay', 'telda');
create type public.money_account as enum ('cash', 'bank', 'telda');
create type public.txn_status as enum ('approved', 'void');
create type public.expense_status as enum ('submitted', 'awaiting_chairman', 'approved', 'rejected', 'purchased', 'cancelled');

-- Numbered documents per season, e.g. CO-2027-0001.
create table private.doc_counters (
  season_id uuid not null references public.seasons (id),
  prefix    text not null,
  next_no   int not null default 1,
  primary key (season_id, prefix)
);

create function private.next_doc_number(p_prefix text, p_season uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_no int;
  v_year int;
begin
  insert into private.doc_counters (season_id, prefix, next_no) values (p_season, p_prefix, 2)
  on conflict (season_id, prefix) do update set next_no = private.doc_counters.next_no + 1
  returning next_no - 1 into v_no;
  select year into v_year from public.seasons where id = p_season;
  return p_prefix || '-' || v_year || '-' || lpad(v_no::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.division_budgets (
  division_id uuid primary key references public.divisions (id),
  amount_egp  numeric(12, 2) not null check (amount_egp >= 0),
  updated_by  uuid references public.users (id) default auth.uid(),
  updated_at  timestamptz not null default now()
);
create trigger division_budgets_touch before update on public.division_budgets
  for each row execute function private.touch_updated_at();

create table public.expense_requests (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references public.seasons (id) default private.active_season_id(),
  team_id             uuid not null references public.teams (id),
  event_id            uuid references public.events (id),
  requested_by        uuid not null default auth.uid() references public.users (id),
  item                text not null check (length(trim(item)) > 0),
  amount_egp          numeric(12, 2) not null check (amount_egp > 0),
  reason              text,
  quote_path          text,
  status              public.expense_status not null default 'submitted',
  curator_decided_by  uuid references public.users (id),
  curator_decided_at  timestamptz,
  chairman_decided_by uuid references public.users (id),
  chairman_decided_at timestamptz,
  reject_reason       text,
  transaction_id      uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index expense_requests_team_idx on public.expense_requests (team_id, status);
create trigger expense_requests_touch before update on public.expense_requests
  for each row execute function private.touch_updated_at();

create table public.sponsorships (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) default private.active_season_id(),
  partner_id    uuid references public.partners (id),
  sponsor_name  text not null,
  tier          text,
  amount_egp    numeric(12, 2) not null check (amount_egp > 0),
  contract_path text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes         text,
  decided_by    uuid references public.users (id),
  decided_at    timestamptz,
  created_by    uuid not null default auth.uid() references public.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger sponsorships_touch before update on public.sponsorships
  for each row execute function private.touch_updated_at();

create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  season_id          uuid not null references public.seasons (id) default private.active_season_id(),
  doc_number         text unique,
  kind               public.txn_kind not null,
  direction          text not null default 'in' check (direction in ('in', 'out')),
  method             public.pay_method not null,
  account            public.money_account,
  amount_gross       numeric(12, 2) not null check (amount_gross > 0),
  vat_applies        boolean,
  vat_amount         numeric(12, 2) not null default 0,
  amount_net         numeric(12, 2),
  item               text,
  supplier           text,
  description        text,
  team_id            uuid references public.teams (id),
  event_id           uuid references public.events (id),
  expense_request_id uuid unique references public.expense_requests (id),
  sponsorship_id     uuid references public.sponsorships (id),
  order_id           uuid,  -- FK added with packages (0011)
  occurred_on        date not null default current_date,
  fatora_path        text,
  expense_form_path  text,
  memo_path          text,
  status             public.txn_status not null default 'approved',
  void_reason        text,
  voided_by          uuid references public.users (id),
  voided_at          timestamptz,
  created_by         uuid references public.users (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (status <> 'void' or length(trim(coalesce(void_reason, ''))) > 0)
);
create index transactions_season_idx on public.transactions (season_id, kind, occurred_on);
create index transactions_team_idx on public.transactions (team_id);
alter table public.expense_requests
  add constraint expense_requests_transaction_fk foreign key (transaction_id) references public.transactions (id);

create table public.reconciliations (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references public.seasons (id) default private.active_season_id(),
  month             date not null,
  account           public.money_account not null,
  statement_balance numeric(12, 2) not null,
  book_balance      numeric(12, 2) not null,
  difference        numeric(12, 2) generated always as (statement_balance - book_balance) stored,
  entered_by        uuid references public.users (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (season_id, month, account)
);

-- Audit every money change (FR-12.8).
create trigger transactions_audit after insert or update or delete on public.transactions
  for each row execute function private.audit();
create trigger expense_requests_audit after insert or update or delete on public.expense_requests
  for each row execute function private.audit();
create trigger sponsorships_audit after insert or update or delete on public.sponsorships
  for each row execute function private.audit();
create trigger division_budgets_audit after insert or update or delete on public.division_budgets
  for each row execute function private.audit();
create trigger reconciliations_audit after insert or update or delete on public.reconciliations
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------
create function private.is_finance_admin(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.leads_kind('operations', p_uid)
$$;

create function private.can_write_txn(p_kind public.txn_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'cash_out' then private.is_finance_admin(p_uid)
         or private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid)
    when p_kind in ('bank_deposit', 'sponsorship') then private.is_finance_admin(p_uid)
         or private.in_team_kind('partnerships', array['executive']::public.member_role[], p_uid)
    else false  -- package sales, refunds, opening balances: created by the database only
  end
$$;

create function private.can_read_txn(p_kind public.txn_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_finance_admin(p_uid) or private.can_write_txn(p_kind, p_uid)
$$;

create function private.can_see_expense_request(
  p_team uuid, p_requested_by uuid, p_status public.expense_status, p_uid uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_requested_by = p_uid
      or private.can_manage_division(private.team_division(p_team), p_uid)
      or private.is_finance_admin(p_uid)
      or (p_status in ('approved', 'purchased')
          and private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid))
$$;

create function private.account_for(p_method public.pay_method) returns public.money_account
language sql immutable set search_path = '' as $$
  select case p_method when 'cash' then 'cash' when 'telda' then 'telda' else 'bank' end::public.money_account
$$;

-- ---------------------------------------------------------------------
-- Cashbook rules
-- ---------------------------------------------------------------------
create function private.transactions_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric := coalesce((private.setting('vat_rate', '0.14'))::text::numeric, 0.14);
  v_req public.expense_requests;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'void' then
      raise exception 'voided_entry_locked';
    end if;
    if new.kind <> old.kind or new.season_id <> old.season_id then
      raise exception 'kind_cannot_change';
    end if;
  else
    -- People can't set generated paths or numbers themselves.
    if auth.uid() is not null then
      new.expense_form_path := null;
      new.memo_path := null;
      new.status := 'approved';
      new.void_reason := null;
    end if;
    new.doc_number := private.next_doc_number(
      case new.kind when 'cash_out' then 'CO' when 'bank_deposit' then 'DEP' when 'sponsorship' then 'SP'
                    when 'package_sale' then 'SALE' when 'refund' then 'REF' else 'OB' end,
      new.season_id);
    if new.expense_request_id is not null then
      select * into v_req from public.expense_requests where id = new.expense_request_id for update;
      if new.kind <> 'cash_out' or v_req.status <> 'approved' then
        raise exception 'expense_request_not_approved';
      end if;
      new.team_id := coalesce(new.team_id, v_req.team_id);
      new.event_id := coalesce(new.event_id, v_req.event_id);
      new.item := coalesce(new.item, v_req.item);
    end if;
  end if;

  if new.kind <> 'opening_balance' then
    new.direction := case when new.kind in ('cash_out', 'refund') then 'out' else 'in' end;
  end if;
  new.account := private.account_for(new.method);
  new.vat_applies := coalesce(new.vat_applies, new.kind in ('bank_deposit', 'sponsorship'));
  -- Money in is recorded net of VAT (FR-12.4): gross includes it.
  new.vat_amount := case when new.vat_applies then round(new.amount_gross * v_rate / (1 + v_rate), 2) else 0 end;
  new.amount_net := new.amount_gross - new.vat_amount;
  new.updated_at := now();
  return new;
end $$;
create trigger transactions_before_write before insert or update on public.transactions
  for each row execute function private.transactions_before_write();

-- A cash out bought for a request marks the request purchased.
create function private.transactions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.expense_requests;
begin
  if new.expense_request_id is not null then
    update public.expense_requests set status = 'purchased', transaction_id = new.id
     where id = new.expense_request_id
    returning * into v_req;
    perform private.notify(array[v_req.requested_by], 'expense_purchased',
      'Purchased: ' || v_req.item, null, '/portal/expenses/' || v_req.id);
  end if;
  return null;
end $$;
create trigger transactions_after_insert after insert on public.transactions
  for each row execute function private.transactions_after_insert();

-- Sponsorship decisions are stamped.
create function private.sponsorships_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger sponsorships_before_update before update on public.sponsorships
  for each row execute function private.sponsorships_before_update();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.division_budgets enable row level security;
alter table public.expense_requests enable row level security;
alter table public.sponsorships enable row level security;
alter table public.transactions enable row level security;
alter table public.reconciliations enable row level security;

create policy "Budget for its Curator and finance" on public.division_budgets for select to authenticated
  using (private.can_manage_division(division_id) or (select private.is_finance_admin()));
create policy "Chairman sets budgets" on public.division_budgets for all to authenticated
  using ((select private.is_chairman())) with check ((select private.is_chairman()));

create policy "Requester, Curator, finance, L&P see requests" on public.expense_requests for select to authenticated
  using (private.can_see_expense_request(team_id, requested_by, status));
create policy "Members request for their own team" on public.expense_requests for insert to authenticated
  with check (requested_by = (select auth.uid())
              and status = 'submitted'
              and season_id = (select private.active_season_id())
              and (select private.is_member())
              and private.can_see_team(team_id));
revoke update, delete on public.expense_requests from anon, authenticated;

create policy "Partnerships and finance see sponsorships" on public.sponsorships for select to authenticated
  using ((select private.can_write_txn('sponsorship')));
create policy "Partnerships and finance add sponsorships" on public.sponsorships for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.can_write_txn('sponsorship')));
create policy "Partnerships and finance update sponsorships" on public.sponsorships for update to authenticated
  using ((select private.can_write_txn('sponsorship'))) with check ((select private.can_write_txn('sponsorship')));
revoke update, delete on public.sponsorships from anon, authenticated;
grant update (partner_id, sponsor_name, tier, amount_egp, contract_path, status, notes) on public.sponsorships to authenticated;

create policy "Read cashbook entries by kind" on public.transactions for select to authenticated
  using (private.can_read_txn(kind));
create policy "Record cashbook entries by kind" on public.transactions for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_write_txn(kind));
create policy "Edit cashbook entries by kind" on public.transactions for update to authenticated
  using (private.can_write_txn(kind)) with check (private.can_write_txn(kind));
revoke update, delete, truncate on public.transactions from anon, authenticated;
grant update (method, amount_gross, vat_applies, item, supplier, description, team_id, event_id,
              occurred_on, fatora_path) on public.transactions to authenticated;

create policy "Finance reads reconciliations" on public.reconciliations for select to authenticated
  using ((select private.is_finance_admin()));
revoke insert, update, delete on public.reconciliations from anon, authenticated;

revoke all on public.division_budgets, public.expense_requests, public.sponsorships,
              public.transactions, public.reconciliations from anon;

-- ---------------------------------------------------------------------
-- Expense request flow (FR-12.10)
--   submitted → (Curator) approved
--             → (Curator, amount over the limit) awaiting_chairman → (Chairman) approved
--             → rejected at either step
--   approved → purchased when L&P records the cash out
-- ---------------------------------------------------------------------
create function public.decide_expense_request(p_id uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.expense_requests;
  v_limit numeric := coalesce((private.setting('expense_chairman_limit_egp', '5000'))::text::numeric, 5000);
  v_chair boolean := private.is_chairman();
  v_new public.expense_status;
begin
  select * into v_req from public.expense_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if v_req.status = 'submitted' then
    if not private.can_manage_division(private.team_division(v_req.team_id)) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif v_req.status = 'awaiting_chairman' then
    if not v_chair then raise exception 'not_allowed' using errcode = '42501'; end if;
  else
    raise exception 'already_decided';
  end if;

  if not p_approve then
    v_new := 'rejected';
  elsif v_req.amount_egp > v_limit and not v_chair then
    v_new := 'awaiting_chairman';
  else
    v_new := 'approved';
  end if;

  update public.expense_requests
     set status = v_new,
         reject_reason = case when v_new = 'rejected' then p_reason end,
         curator_decided_by = case when v_req.status = 'submitted' then auth.uid() else curator_decided_by end,
         curator_decided_at = case when v_req.status = 'submitted' then now() else curator_decided_at end,
         chairman_decided_by = case when v_chair then auth.uid() else chairman_decided_by end,
         chairman_decided_at = case when v_chair then now() else chairman_decided_at end
   where id = p_id;

  if v_new = 'awaiting_chairman' then
    perform private.notify(
      array(select m.user_id from public.memberships m
            where m.season_id = private.active_season_id() and m.role = 'chairman' and m.status = 'active'),
      'expense_needs_chairman', 'Expense over the limit: ' || v_req.item, null, '/portal/expenses/' || p_id);
  elsif v_new = 'approved' then
    perform private.notify(
      array[v_req.requested_by] || array(
        select m.user_id from public.memberships m join public.teams t on t.id = m.team_id
        where m.status = 'active' and m.role = 'executive' and t.kind = 'logistics_planning'
          and m.season_id = private.active_season_id()),
      'expense_approved', 'Approved: ' || v_req.item, null, '/portal/expenses/' || p_id);
  else
    perform private.notify(array[v_req.requested_by], 'expense_rejected', 'Rejected: ' || v_req.item,
      p_reason, '/portal/expenses/' || p_id);
  end if;

  return jsonb_build_object('status', v_new, 'budget', public.division_budget_status(private.team_division(v_req.team_id)));
end $$;

create function public.cancel_expense_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.expense_requests set status = 'cancelled'
   where id = p_id and requested_by = auth.uid() and status in ('submitted', 'awaiting_chairman');
  if not found then raise exception 'cannot_cancel'; end if;
end $$;

-- Division budget vs spent (FR-12.7). No balances, no other divisions.
create function public.division_budget_status(p_division_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_budget numeric;
  v_spent numeric;
  v_committed numeric;
  v_pending numeric;
begin
  if not (private.can_manage_division(p_division_id) or private.is_finance_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select amount_egp into v_budget from public.division_budgets where division_id = p_division_id;
  select coalesce(sum(t.amount_net), 0) into v_spent
  from public.transactions t join public.teams tm on tm.id = t.team_id
  where tm.division_id = p_division_id and t.kind = 'cash_out' and t.status = 'approved';
  select coalesce(sum(r.amount_egp) filter (where r.status = 'approved'), 0),
         coalesce(sum(r.amount_egp) filter (where r.status in ('submitted', 'awaiting_chairman')), 0)
    into v_committed, v_pending
  from public.expense_requests r join public.teams tm on tm.id = r.team_id
  where tm.division_id = p_division_id;
  return jsonb_build_object(
    'budget', v_budget, 'spent', v_spent, 'approved_not_bought', v_committed, 'pending', v_pending,
    'remaining', case when v_budget is null then null else v_budget - v_spent - v_committed end);
end $$;

-- ---------------------------------------------------------------------
-- Voiding, balances, reconciliation
-- ---------------------------------------------------------------------
create function public.void_transaction(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_txn public.transactions;
begin
  select * into v_txn from public.transactions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not (private.is_finance_admin()
          or (v_txn.created_by = auth.uid() and private.can_write_txn(v_txn.kind))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required'; end if;
  if v_txn.status = 'void' then raise exception 'already_void'; end if;

  update public.transactions
     set status = 'void', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_id;
  -- A voided purchase reopens its request so it can be bought again.
  update public.expense_requests set status = 'approved', transaction_id = null
   where transaction_id = p_id;
end $$;

-- Live balances per account (FR-12.5). Finance admins only.
create function public.finance_balances() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_finance_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'bank',  coalesce(sum(case when direction = 'in' then amount_net else -amount_net end) filter (where account = 'bank'), 0),
      'telda', coalesce(sum(case when direction = 'in' then amount_net else -amount_net end) filter (where account = 'telda'), 0),
      'cash',  coalesce(sum(case when direction = 'in' then amount_net else -amount_net end) filter (where account = 'cash'), 0),
      'vat_collected', coalesce(sum(vat_amount) filter (where direction = 'in'), 0),
      'cash_outs_missing_fatora', count(*) filter (where kind = 'cash_out' and fatora_path is null),
      'pending_sponsorships', (select coalesce(sum(amount_egp), 0) from public.sponsorships
                               where status = 'pending' and season_id = private.active_season_id()))
    from public.transactions
    where season_id = private.active_season_id() and status = 'approved');
end $$;

create function private.book_balance(p_season uuid, p_account public.money_account, p_until date) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when direction = 'in' then amount_net else -amount_net end), 0)
  from public.transactions
  where season_id = p_season and account = p_account and status = 'approved' and occurred_on <= p_until
$$;

-- Monthly check against the bank statement or counted cash (FR-12.11).
create function public.record_reconciliation(p_month date, p_account public.money_account, p_statement_balance numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_row public.reconciliations;
begin
  if not private.is_finance_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.reconciliations (month, account, statement_balance, book_balance)
  values (v_month, p_account, p_statement_balance,
          private.book_balance(private.active_season_id(), p_account, (v_month + interval '1 month - 1 day')::date))
  on conflict (season_id, month, account) do update
    set statement_balance = excluded.statement_balance, book_balance = excluded.book_balance,
        entered_by = auth.uid(), created_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- Balances become the new season's opening balances (FR-3.4).
create function private.carry_balances(p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_account public.money_account;
  v_balance numeric;
begin
  if p_from is null then return; end if;
  foreach v_account in array enum_range(null::public.money_account) loop
    v_balance := private.book_balance(p_from, v_account, 'infinity'::date);
    if v_balance <> 0 then
      insert into public.transactions (season_id, kind, direction, method, amount_gross, vat_applies, description)
      values (p_to, 'opening_balance', case when v_balance > 0 then 'in' else 'out' end,
              case v_account when 'cash' then 'cash' when 'telda' then 'telda' else 'bank' end::public.pay_method,
              abs(v_balance), false, 'Carried over from the previous season');
    end if;
  end loop;
end $$;

create or replace function public.activate_season(p_season_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid := private.active_season_id();
begin
  if not private.is_chairman() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_season_id = v_old then
    raise exception 'season_already_active';
  end if;
  if not exists (
    select 1 from public.memberships
    where season_id = p_season_id and role = 'chairman' and status = 'active'
  ) then
    raise exception 'new_season_needs_chairman';
  end if;

  perform private.carry_balances(v_old, p_season_id);
  update public.memberships set status = 'alumni' where season_id = v_old and status = 'active';
  update public.seasons set is_active = false where id = v_old;
  update public.seasons set is_active = true, activated_at = now() where id = p_season_id;
  perform private.log_action('season_rollover', 'seasons', p_season_id::text,
    jsonb_build_object('from', v_old, 'to', p_season_id));
end $$;

revoke execute on function public.decide_expense_request(uuid, boolean, text) from public, anon;
revoke execute on function public.cancel_expense_request(uuid) from public, anon;
revoke execute on function public.division_budget_status(uuid) from public, anon;
revoke execute on function public.void_transaction(uuid, text) from public, anon;
revoke execute on function public.finance_balances() from public, anon;
revoke execute on function public.record_reconciliation(date, public.money_account, numeric) from public, anon;

-- ---------------------------------------------------------------------
-- Finance files: private bucket "finance"
--   fatora/<transaction id>/…   finance admins, L&P Executives
--   docs/<transaction id>/…     generated PDFs (read: same; written by the server)
--   contracts/<sponsorship id>/… finance admins, Partnerships Executives
--   quotes/<request id>/…       the requester (upload) and whoever sees the request
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('finance', 'finance', false)
on conflict (id) do nothing;

create function private.finance_path_access(p_path text, p_write boolean, p_uid uuid default auth.uid()) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := string_to_array(p_path, '/');
  v_id uuid := private.try_uuid(v_parts[2]);
  v_req public.expense_requests;
begin
  if v_id is null or array_length(v_parts, 1) < 3 then
    return false;
  end if;
  case v_parts[1]
    when 'fatora' then
      return private.can_write_txn('cash_out', p_uid);
    when 'docs' then
      return not p_write and private.can_read_txn('cash_out', p_uid);
    when 'contracts' then
      return private.can_write_txn('sponsorship', p_uid);
    when 'quotes' then
      select * into v_req from public.expense_requests where id = v_id;
      if not found then return false; end if;
      return case when p_write then v_req.requested_by = p_uid
                  else private.can_see_expense_request(v_req.team_id, v_req.requested_by, v_req.status, p_uid) end;
    else
      return false;
  end case;
end $$;

create policy "Finance files read" on storage.objects for select to authenticated
  using (bucket_id = 'finance' and private.finance_path_access(name, false));
create policy "Finance files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'finance' and private.finance_path_access(name, true));
