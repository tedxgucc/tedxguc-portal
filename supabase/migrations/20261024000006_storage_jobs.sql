-- =====================================================================
-- 0006 · Rate limits for public forms, file storage rules, scheduled jobs
-- Requirements: FR-1.9, FR-6.1 (attachments), FR-6.4 (reminders)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Rate limits (FR-1.9), used by the public-forms server function.
-- ---------------------------------------------------------------------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Returns true if this hit is allowed.
create function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

create function private.cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.notifications where read_at < now() - interval '180 days';
$$;

-- ---------------------------------------------------------------------
-- Storage buckets
--   avatars     public read · members upload to <their user id>/…
--   site        public read · Chairman, Curators, Executives upload
--               (event photos, speaker photos, partner logos)
--   task-files  private · <task id>/… · whoever can see the task
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('site', 'site', true),
  ('task-files', 'task-files', false)
on conflict (id) do nothing;

create policy "Members upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Board uploads site images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and (select private.my_role()) in ('chairman', 'curator', 'executive'));
create policy "Board replaces site images" on storage.objects for update to authenticated
  using (bucket_id = 'site' and (select private.my_role()) in ('chairman', 'curator', 'executive'));
create policy "Board deletes site images" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and (select private.my_role()) in ('chairman', 'curator', 'executive'));

create policy "Read files of visible tasks" on storage.objects for select to authenticated
  using (bucket_id = 'task-files'
         and private.can_see_task(private.try_uuid((storage.foldername(name))[1])));
create policy "Upload files to visible tasks" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files'
              and private.can_see_task(private.try_uuid((storage.foldername(name))[1])));
create policy "Managers delete task files" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files'
         and private.can_manage_task(private.try_uuid((storage.foldername(name))[1])));

-- ---------------------------------------------------------------------
-- Guests (anon) get no table access at all to member-only data, as a
-- second line of defence behind the row-level security policies.
-- ---------------------------------------------------------------------
revoke all on
  public.users, public.user_private, public.memberships, public.invites,
  public.role_change_requests, public.settings, public.notifications, public.audit_log,
  public.inquiries, public.registrations, public.event_staff, public.checkin_scans,
  public.run_of_show, public.tasks, public.task_assignees, public.task_comments,
  public.task_attachments, public.announcements, public.announcement_reads,
  public.org_chart
from anon;

-- ---------------------------------------------------------------------
-- Scheduled jobs (pg_cron). Skipped where pg_cron isn't installed,
-- e.g. the in-memory test database.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('task-reminders', '*/15 * * * *', 'select private.run_task_reminders()');
    perform cron.schedule('daily-cleanup', '17 3 * * *', 'select private.cleanup()');
  end if;
end $$;
