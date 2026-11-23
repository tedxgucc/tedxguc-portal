-- =====================================================================
-- 0062 · Invited accounts that were created before the member set a
--        password (the old invite email path made the login account at
--        once). "Set your password" on the login page then failed with
--        "User already registered". This finds such an account so the
--        server can set its first password.
--
-- Only accounts that never signed in, have no password yet, and came
-- from an invite that is still valid (accepted by this account, not
-- revoked) qualify. Called by the public-forms server function only.
-- =====================================================================
create function public.invited_account_to_claim(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id
  from auth.users u
  join public.invites i on i.accepted_by = u.id and i.revoked_at is null
  where lower(u.email) = lower(trim(p_email))
    and u.last_sign_in_at is null
    and coalesce(u.encrypted_password, '') = ''
  limit 1
$$;
revoke execute on function public.invited_account_to_claim(text) from public, anon, authenticated;
grant execute on function public.invited_account_to_claim(text) to service_role;
