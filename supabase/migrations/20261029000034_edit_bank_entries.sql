-- Correct bank movements atomically while retaining the original audit record.
create function public.edit_bank_transaction(p_id uuid, p_direction text, p_amount numeric,
  p_date date, p_description text, p_vat boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.transactions;
  v_kind public.txn_kind;
  v_id uuid;
begin
  select * into v_old from public.transactions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.account <> 'bank' or v_old.kind::text not in ('bank_deposit', 'sponsorship', 'bank_out') then
    raise exception 'entry_not_editable';
  end if;
  if p_direction not in ('in', 'out') or p_direction is null then raise exception 'invalid_direction'; end if;
  if p_amount is null or p_amount <= 0 or p_amount::text = 'NaN' then raise exception 'invalid_amount'; end if;
  if p_date is null then raise exception 'date_required'; end if;
  v_kind := case when p_direction = 'out' then 'bank_out'::public.txn_kind
                 when v_old.kind::text = 'sponsorship' then 'sponsorship'::public.txn_kind
                 else 'bank_deposit'::public.txn_kind end;
  if not (private.is_finance_admin() or (v_old.created_by = auth.uid()
      and private.can_write_txn(v_old.kind))) or not private.can_write_txn(v_kind) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_old.season_id <> private.active_season_id() then raise exception 'season_closed'; end if;
  perform public.void_transaction(p_id, p_reason);
  insert into public.transactions (season_id, kind, method, amount_gross, occurred_on,
    description, vat_applies, item, supplier, team_id, event_id, sponsorship_id, created_by)
  values (v_old.season_id, v_kind, v_old.method, p_amount, p_date, nullif(trim(p_description), ''),
    case when p_direction = 'out' then false else coalesce(p_vat, false) end,
    null, v_old.supplier, v_old.team_id, v_old.event_id,
    case when p_direction = 'in' then v_old.sponsorship_id else null end, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.edit_bank_transaction(uuid, text, numeric, date, text, boolean, text) from public, anon;
grant execute on function public.edit_bank_transaction(uuid, text, numeric, date, text, boolean, text) to authenticated;
