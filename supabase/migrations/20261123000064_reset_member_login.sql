-- 0064 · The Chairman resets a member's login: the password is cleared and
--        every session signed out, so the member sets a new password with
--        "Set your password" on the login page (needs their invite).
create function public.reset_member_login(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_chairman() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_reset_yourself'; end if;
  if not exists (select 1 from public.invites i where i.accepted_by = p_user_id and i.revoked_at is null) then
    raise exception 'no_invite';
  end if;
  update auth.users set encrypted_password = '' where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;
end $$;
revoke execute on function public.reset_member_login(uuid) from public, anon;
grant execute on function public.reset_member_login(uuid) to authenticated;
