-- =====================================================================
-- 0066 · Cash in, and bank out straight into cash.
--   Cash in:  money received in cash (no VAT, like the other cash entries).
--             Numbered CI-2027-0001. Same people who record cash out.
--   Bank out → cash: a withdrawal. Recording a bank out with to_cash
--             adds the matching cash in automatically (linked), so the bank
--             goes down and the cash goes up by the same amount. Voiding the
--             bank out voids its cash side too.
-- =====================================================================
alter type public.txn_kind add value if not exists 'cash_in';

alter table public.transactions
  add column if not exists to_cash boolean not null default false,
  add column if not exists linked_id uuid references public.transactions (id);
create index if not exists transactions_linked_idx on public.transactions (linked_id) where linked_id is not null;

-- Written with ::text so this file can use the new value in the same run.
create or replace function private.can_write_txn(p_kind public.txn_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_kind::text in ('cash_out', 'cash_in') then private.is_finance_admin(p_uid)
         or private.in_team_kind('logistics_planning', array['executive']::public.member_role[], p_uid)
    when p_kind::text in ('bank_deposit', 'sponsorship') then private.is_finance_admin(p_uid)
         or private.in_team_kind('partnerships', array['executive']::public.member_role[], p_uid)
    when p_kind::text = 'bank_out' then private.is_finance_admin(p_uid)
    else false  -- package sales, refunds, opening balances: created by the database only
  end
$$;

create or replace function private.transactions_before_write() returns trigger
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
    -- A withdrawal's amount and direction stay as recorded; void and redo to change it.
    if old.to_cash and (new.amount_gross <> old.amount_gross or new.to_cash <> old.to_cash) and new.status = old.status then
      raise exception 'withdrawal_locked';
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
      case new.kind::text when 'cash_out' then 'CO' when 'cash_in' then 'CI' when 'bank_deposit' then 'DEP' when 'sponsorship' then 'SP'
                          when 'package_sale' then 'SALE' when 'refund' then 'REF' when 'bank_out' then 'BO' else 'OB' end,
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

  if new.kind::text <> 'opening_balance' then
    new.direction := case when new.kind::text in ('cash_out', 'refund', 'bank_out') then 'out' else 'in' end;
  end if;
  if new.kind::text = 'bank_out' then
    new.method := 'bank';
    new.vat_applies := false;
  else
    new.to_cash := false;
  end if;
  if new.kind::text = 'cash_in' then
    new.method := 'cash';
    new.vat_applies := false;  -- cash in has no VAT
  end if;
  new.account := private.account_for(new.method);
  new.vat_applies := coalesce(new.vat_applies, new.kind::text in ('bank_deposit', 'sponsorship'));
  -- Money in is recorded net of VAT (FR-12.4): gross includes it.
  new.vat_amount := case when new.vat_applies then round(new.amount_gross * v_rate / (1 + v_rate), 2) else 0 end;
  new.amount_net := new.amount_gross - new.vat_amount;
  new.updated_at := now();
  return new;
end $$;

-- Bank out to cash: add the matching cash in.
create or replace function private.transactions_withdrawal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind::text = 'bank_out' and new.to_cash then
    insert into public.transactions (season_id, kind, method, amount_gross, item, description, team_id, event_id, occurred_on, linked_id, created_by)
    values (new.season_id, 'cash_in', 'cash', new.amount_gross,
            'From the bank (' || coalesce(new.doc_number, 'withdrawal') || ')',
            coalesce(new.item, 'Cash withdrawal'), new.team_id, new.event_id, new.occurred_on, new.id, new.created_by);
  end if;
  return new;
end $$;
drop trigger if exists transactions_withdrawal on public.transactions;
create trigger transactions_withdrawal after insert on public.transactions
  for each row execute function private.transactions_withdrawal();

create or replace function public.void_transaction(p_id uuid, p_reason text) returns void
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
  -- The cash side of a withdrawal goes with its bank out.
  if v_txn.linked_id is not null then raise exception 'void_the_bank_out'; end if;

  update public.transactions
     set status = 'void', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_id or (linked_id = p_id and status <> 'void');
  -- A voided purchase reopens its request so it can be bought again.
  update public.expense_requests set status = 'approved', transaction_id = null
   where transaction_id = p_id;
end $$;
