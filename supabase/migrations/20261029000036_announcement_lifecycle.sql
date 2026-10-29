-- Scheduled publication, expiry, and author-only confirmation reporting.
alter table public.announcements add column publish_at timestamptz not null default now(),
 add column expires_at timestamptz, add column notified_at timestamptz;
alter table public.announcements add constraint announcement_dates check(expires_at is null or expires_at > publish_at);
update public.announcements set notified_at = created_at;
grant update(publish_at, expires_at) on public.announcements to authenticated;
create or replace function private.can_see_announcement(p_id uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.announcements a where a.id = p_id and (
  a.author_id = p_uid or private.is_chairman(p_uid) or
  (a.season_id = private.active_season_id() and a.publish_at <= now() and (a.expires_at is null or a.expires_at > now())
   and private.in_audience(a.audience_type, a.division_id, a.team_id, a.audience_role, p_uid))))
$$;
drop policy "Audience reads announcements" on public.announcements;
create policy "Audience reads announcements" on public.announcements for select to authenticated
 using(author_id = auth.uid() or private.is_chairman() or
  (season_id = private.active_season_id() and publish_at <= now() and (expires_at is null or expires_at > now())
   and private.in_audience(audience_type, division_id, team_id, audience_role)));
create function private.publish_due_announcements() returns void
language plpgsql security definer set search_path = '' as $$
declare a public.announcements;
begin
 for a in select * from public.announcements where notified_at is null and publish_at <= now()
  and season_id = private.active_season_id() and (expires_at is null or expires_at > now()) for update skip locked
 loop
  perform private.notify(array(select m.user_id from public.memberships m where m.season_id = a.season_id
   and m.status = 'active' and m.user_id <> a.author_id
   and private.in_audience(a.audience_type, a.division_id, a.team_id, a.audience_role, m.user_id)),
   'announcement', a.title, left(a.body,200), '/portal/news');
  update public.announcements set notified_at = now() where id = a.id;
 end loop;
end $$;
revoke all on function private.publish_due_announcements() from public, anon, authenticated;
create or replace function private.announcements_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform private.publish_due_announcements();
 return null;
end $$;
create function public.announcement_confirmations(p_id uuid)
returns table(user_id uuid, name text, read_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare a public.announcements;
begin
 select * into a from public.announcements where id = p_id;
 if not found then raise exception 'not_found'; end if;
 if not (a.author_id = auth.uid() or private.is_chairman()) then raise exception 'not_allowed' using errcode = '42501'; end if;
 return query select m.user_id, u.name, r.read_at from public.memberships m join public.users u on u.id = m.user_id
 left join public.announcement_reads r on r.announcement_id = a.id and r.user_id = m.user_id
 where m.season_id = a.season_id and m.status = 'active' and m.user_id <> a.author_id
 and private.in_audience(a.audience_type,a.division_id,a.team_id,a.audience_role,m.user_id) order by u.name;
end $$;
revoke all on function public.announcement_confirmations(uuid) from public, anon;
grant execute on function public.announcement_confirmations(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_extension where extname = 'pg_cron') then
  perform cron.schedule('publish-announcements', '* * * * *', 'select private.publish_due_announcements()');
 end if;
end $$;
create trigger announcements_publish_edit after update of publish_at on public.announcements
 for each row when (new.notified_at is null) execute function private.announcements_notify();
