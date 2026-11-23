-- 0063 · An invited member who once signed in through the old email link
--        but never set a password could not use "Set your password".
--        Allow any invited, email-only account that still has no password.
create or replace function public.invited_account_to_claim(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id
  from auth.users u
  join public.invites i on i.accepted_by = u.id and i.revoked_at is null
  where lower(u.email) = lower(trim(p_email))
    and coalesce(u.encrypted_password, '') = ''
    and not exists (select 1 from auth.identities x where x.user_id = u.id and x.provider <> 'email')
  limit 1
$$;
