-- One application per email OR phone in each recruitment round, regardless
-- of stage. Keep existing records, including any historical duplicates.
create function private.application_phone_key(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select nullif(case
    when digits ~ '^201[0125][0-9]{8}$' then '0' || substr(digits, 3)
    when digits ~ '^1[0125][0-9]{8}$' then '0' || digits
    else digits end, '')
  from (select regexp_replace(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '^00', '') as digits) normalized
$$;

-- Unique claims serialize concurrent submissions without serializing an
-- entire recruitment round. Only hashes are stored; guest APIs cannot read
-- the claims. Existing privacy purges delete them with their application.
create table private.application_identity_claims (
  cycle_id uuid not null references public.recruitment_cycles(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  identity_hash text not null,
  application_id uuid not null references public.applications(id) on delete cascade,
  primary key(cycle_id, kind, identity_hash)
);
alter table private.application_identity_claims enable row level security;
revoke all on private.application_identity_claims from public, anon, authenticated;

insert into private.application_identity_claims(cycle_id, kind, identity_hash, application_id)
select a.cycle_id, identity.kind, private.hash_token(identity.value), a.id
from public.applications a
cross join lateral (values
  ('email', lower(trim(a.applicant_email))),
  ('phone', private.application_phone_key(a.applicant_phone))
) identity(kind, value)
where identity.value is not null
order by a.created_at, a.id
on conflict (cycle_id, kind, identity_hash) do nothing;

-- Replace the old active-only email index: withdrawn applications also count.
drop index public.applications_one_per_email;
create index applications_email_lookup on public.applications(cycle_id, lower(trim(applicant_email)));
create index applications_phone_lookup on public.applications(cycle_id, private.application_phone_key(applicant_phone));

create function private.claim_application_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.application_phone_key(new.applicant_phone); v_identity record;
begin
  -- Also cover legacy duplicate records if their original claim owner was
  -- removed separately. Never remove or rewrite historical applications.
  if exists(select 1 from public.applications a where a.id <> new.id and a.cycle_id = new.cycle_id
    and (lower(trim(a.applicant_email)) = lower(trim(new.applicant_email))
      or (v_phone is not null and private.application_phone_key(a.applicant_phone) = v_phone))) then
    raise exception 'already_applied';
  end if;
  for v_identity in select * from (values
    ('email', lower(trim(new.applicant_email))), ('phone', v_phone)
  ) identities(kind, value) where value is not null loop
    insert into private.application_identity_claims as claims(cycle_id, kind, identity_hash, application_id)
      values(new.cycle_id, v_identity.kind, private.hash_token(v_identity.value), new.id)
      on conflict(cycle_id, kind, identity_hash) do update set application_id = excluded.application_id
      where claims.application_id = excluded.application_id;
    if not found then raise exception 'already_applied'; end if;
  end loop;
  return null;
end $$;
create trigger applications_claim_identity after insert or update of cycle_id, applicant_email, applicant_phone
  on public.applications for each row execute function private.claim_application_identity();
