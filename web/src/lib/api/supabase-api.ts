// The real API: Supabase tables (under row-level security), database
// functions (rpc) and server functions (functions.invoke).
import { db } from '../supabase';
import { ALLOWED_DOMAINS, BASE_PATH } from '../env';
import type {
  Announcement, CalendarItem, Me, Member, Task, TicketView, TxEvent,
} from '../types';
import { toApiError } from './errors';
import { ApiError, type Api } from './types';

const EVENT_COLS = 'id, type, title, slug, description, agenda, starts_at, ends_at, venue, capacity, registration_opens_at, registration_closes_at, license_status, is_public, status, ticket_prefix, cover_url';

// Lists come back as [] rather than null; single rows may be null.
async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}

// Server functions return { error, message } with an HTTP error status.
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null);
      if (payload?.error) throw new ApiError(payload.error, payload.message ?? payload.error);
    }
    throw toApiError(error);
  }
  return data as T;
}

async function activeSeasonId(): Promise<string | null> {
  const s = await run(db().from('seasons').select('id').eq('is_active', true).maybeSingle());
  return (s as { id: string } | null)?.id ?? null;
}

async function uid(): Promise<string> {
  const { data } = await db().auth.getUser();
  if (!data.user) throw new ApiError('login_required', 'Log in again to continue.');
  return data.user.id;
}

export const supabaseApi: Api = {
  // ----- Public site -----
  async listEvents(scope) {
    let q = db().from('events').select(EVENT_COLS).neq('status', 'draft');
    const now = new Date().toISOString();
    if (scope === 'upcoming') q = q.gte('starts_at', now).eq('status', 'published').order('starts_at');
    else if (scope === 'past') q = q.lt('starts_at', now).order('starts_at', { ascending: false });
    else q = q.order('starts_at', { ascending: false });
    return (await run(q)) as TxEvent[];
  },
  async getEventBySlug(slug) {
    return (await run(db().from('events').select(EVENT_COLS).eq('slug', slug).maybeSingle())) as TxEvent | null;
  },
  async getEventFields(eventId) {
    return run(db().from('event_fields').select('*').eq('event_id', eventId).order('position'));
  },
  async listSpeakers(eventId) {
    let q = db().from('speakers').select('id, event_id, name, bio, photo_url, talk_title, talk_url').eq('is_public', true);
    if (eventId) q = q.eq('event_id', eventId);
    return run(q.order('name'));
  },
  async listPartners() {
    return run(db().from('partners').select('id, company, tier, logo_url, website').eq('is_public', true).order('sort_order'));
  },
  async getSections(keys) {
    const rows = await run(db().from('site_sections').select('key, title, body').in('key', keys).eq('is_published', true));
    return Object.fromEntries((rows ?? []).map((r: { key: string }) => [r.key, r])) as never;
  },
  async getBoard() {
    return run(db().rpc('get_public_board'));
  },
  async publicCalendar(from, to) {
    return run(db().rpc('calendar_feed', { p_from: from, p_to: to }));
  },
  async register(input) {
    return invoke('public-forms', { action: 'register', ...input });
  },
  async getTicket(token) {
    return (await run(db().rpc('get_registration_by_token', { p_status_token: token }))) as TicketView | null;
  },
  async cancelTicket(token) {
    await invoke('public-forms', { action: 'cancel', status_token: token });
  },
  async resendTicket(eventId, email, turnstileToken) {
    await invoke('public-forms', { action: 'resend', event_id: eventId, email, turnstile_token: turnstileToken });
  },
  async sendInquiry(input) {
    await invoke('public-forms', { action: 'inquiry', ...input });
  },

  // ----- Accounts -----
  async getMe() {
    const { data } = await db().auth.getUser();
    if (!data.user) return null;
    const season = await activeSeasonId();
    const [profile, membership] = await Promise.all([
      run(db().from('users').select('id, name, email, photo_url').eq('id', data.user.id).maybeSingle()),
      season
        ? run(db().from('org_chart').select('role, team_id, team, team_kind, division_id, division, division_kind')
            .eq('user_id', data.user.id).eq('season_id', season).eq('status', 'active').maybeSingle())
        : Promise.resolve(null),
    ]);
    if (!profile) return null;
    const p = profile as { id: string; name: string; email: string; photo_url: string | null };
    const m = membership as Record<string, string | null> | null;
    return {
      ...p,
      role: (m?.role as Me['role']) ?? null,
      team_id: m?.team_id ?? null,
      team_name: m?.team ?? null,
      team_kind: (m?.team_kind as Me['team_kind']) ?? null,
      division_id: m?.division_id ?? null,
      division_name: m?.division ?? null,
      division_kind: (m?.division_kind as Me['division_kind']) ?? null,
    };
  },
  async signInWithGoogle() {
    const { error } = await db().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${BASE_PATH}/auth/callback`,
        // Shows only GUC accounts in Google's picker; the database checks again.
        queryParams: { hd: ALLOWED_DOMAINS[0], prompt: 'select_account' },
      },
    });
    if (error) throw toApiError(error);
  },
  async signUpWithEmail(email, password) {
    const { data, error } = await db().auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${BASE_PATH}/auth/callback` } });
    if (error) throw toApiError(error);
    return !!data.session;
  },
  async signInWithEmail(email, password) {
    const { error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw new ApiError('login_failed', 'That email and password don’t match.');
  },
  async sendPasswordReset(email) {
    const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${BASE_PATH}/auth/callback?next=/portal/profile` });
    if (error) throw toApiError(error);
  },
  async signOut(everywhere) {
    await db().auth.signOut({ scope: everywhere ? 'global' : 'local' });
  },
  async updateProfile(patch) {
    const id = await uid();
    const { phone, ...rest } = patch;
    if (Object.keys(rest).length) await run(db().from('users').update(rest).eq('id', id));
    if (phone !== undefined) await run(db().from('user_private').update({ phone }).eq('user_id', id));
  },
  async rotateCalendarToken() {
    return run(db().rpc('rotate_calendar_feed_token'));
  },

  // ----- Structure -----
  async listDivisions() {
    const season = await activeSeasonId();
    return run(db().from('divisions').select('id, name, kind').eq('season_id', season).order('name'));
  },
  async listTeams() {
    const season = await activeSeasonId();
    return run(db().from('teams').select('id, name, kind, division_id').eq('season_id', season).order('name'));
  },
  async listMembers() {
    const season = await activeSeasonId();
    const rows = await run(db().from('org_chart')
      .select('user_id, name, photo_url, role, team_id, team, division_id, division, division_kind')
      .eq('season_id', season).eq('status', 'active').order('name'));
    return rows as Member[];
  },
  async listInvites() {
    return run(db().from('invites').select('id, email, role, team_id, division_id, expires_at, accepted_at, revoked_at, created_at')
      .order('created_at', { ascending: false }).limit(100));
  },
  async createInvite(input) {
    const season = await activeSeasonId();
    const me = await uid();
    const row = await run(db().from('invites').insert({ ...input, email: input.email.trim().toLowerCase(), season_id: season, invited_by: me })
      .select('id').single());
    await invoke('staff-actions', { action: 'send_invite', invite_id: (row as unknown as { id: string }).id });
  },
  async revokeInvite(id) {
    await run(db().from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id));
  },

  // ----- Tasks -----
  async listTasks() {
    const rows = await run(db().from('tasks').select('*, task_assignees(user_id)').order('deadline', { ascending: true, nullsFirst: false }));
    return (rows as (Task & { task_assignees: { user_id: string }[] })[]).map(({ task_assignees, ...t }) => ({
      ...t, assignees: task_assignees.map((a) => a.user_id),
    }));
  },
  async createTask(input) {
    const me = await uid();
    const { assignees, ...task } = input;
    const row = (await run(db().from('tasks').insert({ ...task, created_by: me }).select('*').single())) as Task;
    if (assignees.length) {
      await run(db().from('task_assignees').insert(assignees.map((user_id) => ({ task_id: row.id, user_id }))));
    }
    return { ...row, assignees };
  },
  async updateTask(id, patch) {
    await run(db().from('tasks').update(patch).eq('id', id));
  },
  async setAssignees(taskId, userIds) {
    const current = ((await run(db().from('task_assignees').select('user_id').eq('task_id', taskId))) as { user_id: string }[]).map((r) => r.user_id);
    const add = userIds.filter((u) => !current.includes(u));
    const remove = current.filter((u) => !userIds.includes(u));
    if (remove.length) await run(db().from('task_assignees').delete().eq('task_id', taskId).in('user_id', remove));
    if (add.length) await run(db().from('task_assignees').insert(add.map((user_id) => ({ task_id: taskId, user_id }))));
  },
  async listComments(taskId) {
    return run(db().from('task_comments').select('id, task_id, user_id, body, created_at').eq('task_id', taskId).order('created_at'));
  },
  async addComment(taskId, body, mentions) {
    const me = await uid();
    await run(db().from('task_comments').insert({ task_id: taskId, user_id: me, body, mentions }));
  },

  // ----- Calendar & news -----
  async calendarFeed(from, to, teamId) {
    return (await run(db().rpc('calendar_feed', { p_from: from, p_to: to, p_team: teamId ?? null }))) as CalendarItem[];
  },
  async createCalendarEntry(input) {
    const me = await uid();
    await run(db().from('calendar_entries').insert({ ...input, created_by: me }));
  },
  async deleteCalendarEntry(id) {
    await run(db().from('calendar_entries').delete().eq('id', id));
  },
  async listAnnouncements() {
    const me = await uid();
    const rows = await run(db().from('announcements').select('*, announcement_reads(user_id)')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50));
    return (rows as (Announcement & { announcement_reads: { user_id: string }[] })[]).map(({ announcement_reads, ...a }) => ({
      ...a, read_by_me: announcement_reads.some((r) => r.user_id === me),
    }));
  },
  async postAnnouncement(input) {
    const me = await uid();
    await run(db().from('announcements').insert({ ...input, author_id: me }));
  },
  async confirmRead(id) {
    const me = await uid();
    await run(db().from('announcement_reads').upsert({ announcement_id: id, user_id: me }, { ignoreDuplicates: true }));
  },
  async listNotifications() {
    return run(db().from('notifications').select('id, type, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(50));
  },
  async markNotificationsRead() {
    await run(db().rpc('mark_notifications_read'));
  },

  // ----- Events admin & door -----
  async listAllEvents() {
    return (await run(db().from('events').select(EVENT_COLS).order('starts_at', { ascending: false }))) as TxEvent[];
  },
  async saveEvent(input) {
    const { id, ...fields } = input;
    const q = id ? db().from('events').update(fields).eq('id', id) : db().from('events').insert(fields);
    return (await run(q.select(EVENT_COLS).single())) as TxEvent;
  },
  async listRegistrations(eventId) {
    return run(db().from('registrations')
      .select('id, guest_name, guest_email, guest_phone, guest_type, status, ticket_no, checked_in_at, created_at')
      .eq('event_id', eventId).order('created_at', { ascending: false }));
  },
  async eventStats(eventId) {
    return run(db().rpc('event_stats', { p_event_id: eventId }));
  },
  async checkIn(eventId, code, deviceId) {
    return run(db().rpc('check_in', { p_event_id: eventId, p_ticket_code: code, p_device_id: deviceId }));
  },
  async checkInById(registrationId, deviceId) {
    return run(db().rpc('check_in_registration', { p_registration_id: registrationId, p_device_id: deviceId }));
  },
  async searchRegistrations(eventId, q) {
    return run(db().rpc('search_registrations', { p_event_id: eventId, p_query: q }));
  },
  async getManifest(eventId) {
    return run(db().rpc('get_checkin_manifest', { p_event_id: eventId }));
  },
  async syncOffline(eventId, scans) {
    return run(db().rpc('sync_offline_checkins', { p_event_id: eventId, p_scans: scans }));
  },
};
