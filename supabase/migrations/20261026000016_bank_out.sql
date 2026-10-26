-- Bank in / bank out from the Bank tab (FR-12.4, FR-12.5).
-- "Bank in" is a bank deposit (VAT optional); "bank out" is money paid
-- straight from the bank (transfers, bank fees, payments by cheque).
-- Bank out is for finance admins only: the Chairman and the Ops Curator.
alter type public.txn_kind add value if not exists 'bank_out';

-- Written with ::text so this file can use the new value in the same run.
create or replace function private.can_write_txn(p_kind public.txn_kind, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_kind::text = 'cash_out' then private.is_finance_admin(p_uid)
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
  else
    -- People can't set generated paths or numbers themselves.
    if auth.uid() is not null then
      new.expense_form_path := null;
      new.memo_path := null;
      new.status := 'approved';
      new.void_reason := null;
    end if;
    new.doc_number := private.next_doc_number(
      case new.kind::text when 'cash_out' then 'CO' when 'bank_deposit' then 'DEP' when 'sponsorship' then 'SP'
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
  end if;
  new.account := private.account_for(new.method);
  new.vat_applies := coalesce(new.vat_applies, new.kind::text in ('bank_deposit', 'sponsorship'));
  -- Money in is recorded net of VAT (FR-12.4): gross includes it.
  new.vat_amount := case when new.vat_applies then round(new.amount_gross * v_rate / (1 + v_rate), 2) else 0 end;
  new.amount_net := new.amount_gross - new.vat_amount;
  new.updated_at := now();
  return new;
end $$;
