// Admin API: Chairman settings, structure, season rollover, role changes,
// audit log (FR-3, FR-14); site sections (FR-1.4); inquiries (FR-1.6);
// event questions, door staff and run of show (FR-5).
import { DEMO } from '../env';
import { db } from '../supabase';
import type { DivisionKind, EventField, Role, Speaker, TeamKind } from '../types';
import { demoAdminApi } from './admin-demo';
import { toApiError } from './errors';
import { ApiError } from './types';

export type Settings = Record<string, unknown>;
export type Season = { id: string; year: number; theme: string | null; is_active: boolean; activated_at: string | null };
export type RoleRequest = {
  id: string; membership_id: string; user_id: string | null; name: string; current_role: Role | null; current_team: string | null;
  new_role: Role | null; new_team_id: string | null; new_division_id: string | null; remove: boolean; reason: string | null;
  requested_by: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; decided_at: string | null;
};
export type RoleRequestInput = { user_id: string; new_role: Role | null; new_team_id: string | null; new_division_id: string | null; remove: boolean; reason: string };
export type AuditRow = { id: number; user_id: string | null; action: string; target_type: string; target_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; created_at: string };
export type SiteSection = { key: string; owner_kind: DivisionKind | null; title: string; body: { text?: string; items?: { q: string; a: string }[] }; is_published: boolean; updated_at: string };
export type Inquiry = { id: string; kind: 'partner' | 'contact'; name: string; email: string; phone: string | null; company: string | null; message: string; status: 'new' | 'handled'; handled_by: string | null; created_at: string };
export type StaffRow = { event_id: string; user_id: string; duty: string };
export type RunItem = { id: string; event_id: string; position: number; starts_at: string; ends_at: string | null; item: string; owner_id: string | null; notes: string | null };
export type FieldInput = Omit<EventField, 'id'> & { id?: string };
export type SpeakerInput = Omit<Speaker, 'id'> & { id?: string };
export type RunItemInput = Omit<RunItem, 'id'> & { id?: string };

export interface AdminApi {
  getSettings(): Promise<Settings>;
  saveSetting(key: string, value: unknown): Promise<void>;
  listSeasons(): Promise<Season[]>;
  updateSeasonTheme(id: string, theme: string): Promise<void>;
  prepareSeason(year: number, theme: string, chairmanId: string): Promise<string>;
  activateSeason(id: string): Promise<void>;
  renameTeam(id: string, name: string): Promise<void>;
  addTeam(divisionId: string, name: string, kind?: TeamKind): Promise<void>;
  renameDivision(id: string, name: string): Promise<void>;
  listRoleRequests(): Promise<RoleRequest[]>;
  requestRoleChange(input: RoleRequestInput): Promise<void>;
  decideRoleChange(id: string, approve: boolean): Promise<void>;
  listAudit(limit?: number): Promise<AuditRow[]>;
  listSections(): Promise<SiteSection[]>;
  saveSection(key: string, patch: Pick<SiteSection, 'title' | 'body' | 'is_published'>): Promise<void>;
  listInquiries(): Promise<Inquiry[]>;
  markInquiry(id: string, handled: boolean): Promise<void>;
  saveEventField(input: FieldInput): Promise<void>;
  deleteEventField(id: string): Promise<void>;
  listStaff(eventId: string): Promise<StaffRow[]>;
  /** Events where I am door staff (gives door access to people outside Operations). */
  myStaffEvents(): Promise<string[]>;
  setStaff(eventId: string, userId: string, on: boolean): Promise<void>;
  listRunOfShow(eventId: string): Promise<RunItem[]>;
  saveRunItem(input: RunItemInput): Promise<void>;
  deleteRunItem(id: string): Promise<void>;
  /** Upload a photo for the site (events, speakers, announcements); returns its public URL. */
  uploadImage(file: File, folder: 'events' | 'speakers' | 'announcements' | 'partners'): Promise<string>;
  listEventSpeakers(eventId: string): Promise<Speaker[]>;
  saveSpeaker(input: SpeakerInput): Promise<void>;
  deleteSpeaker(id: string): Promise<void>;
}

async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}
async function uid() {
  const { data } = await db().auth.getUser();
  if (!data.user) throw new ApiError('login_required', 'Log in again to continue.');
  return data.user.id;
}
async function activeSeason(): Promise<string> {
  const s = await run(db().from('seasons').select('id').eq('is_active', true).maybeSingle()) as { id: string } | null;
  if (!s) throw new ApiError('no_active_season', 'There is no active season.');
  return s.id;
}

type OrgRow = { membership_id: string; user_id: string; name: string; role: Role; team: string | null };

// ---------------------------------------------------------------- live
const liveAdmin: AdminApi = {
  async getSettings() {
    const season = await activeSeason();
    const rows = await run(db().from('settings').select('key, value').eq('season_id', season)) as { key: string; value: unknown }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  async saveSetting(key, value) {
    const season = await activeSeason();
    await run(db().from('settings').upsert({ season_id: season, key, value }));
  },
  async listSeasons() {
    return run(db().from('seasons').select('id, year, theme, is_active, activated_at').order('year', { ascending: false }));
  },
  async updateSeasonTheme(id, theme) {
    await run(db().from('seasons').update({ theme: theme.trim() || null }).eq('id', id));
  },
  async prepareSeason(year, theme, chairmanId) {
    return run(db().rpc('prepare_season', { p_year: year, p_theme: theme, p_chairman: chairmanId }));
  },
  async activateSeason(id) {
    await run(db().rpc('activate_season', { p_season_id: id }));
  },
  async renameTeam(id, name) {
    await run(db().from('teams').update({ name: name.trim() }).eq('id', id));
  },
  async addTeam(divisionId, name, kind = 'other') {
    const season = await activeSeason();
    await run(db().from('teams').insert({ season_id: season, division_id: divisionId, name: name.trim(), kind }));
  },
  async renameDivision(id, name) {
    await run(db().from('divisions').update({ name: name.trim() }).eq('id', id));
  },
  async listRoleRequests() {
    const rows = await run(db().from('role_change_requests')
      .select('id, membership_id, new_role, new_team_id, new_division_id, remove, reason, requested_by, status, created_at, decided_at')
      .order('created_at', { ascending: false }).limit(200)) as Omit<RoleRequest, 'user_id' | 'name' | 'current_role' | 'current_team'>[];
    const ids = [...new Set(rows.map((r) => r.membership_id))];
    const org = ids.length
      ? await run(db().from('org_chart').select('membership_id, user_id, name, role, team').in('membership_id', ids)) as OrgRow[]
      : [];
    return rows.map((r) => {
      const o = org.find((x) => x.membership_id === r.membership_id);
      return { ...r, user_id: o?.user_id ?? null, name: o?.name ?? 'Former member', current_role: o?.role ?? null, current_team: o?.team ?? null };
    });
  },
  async requestRoleChange(input) {
    const season = await activeSeason();
    const m = await run(db().from('org_chart').select('membership_id')
      .eq('user_id', input.user_id).eq('season_id', season).eq('status', 'active').maybeSingle()) as { membership_id: string } | null;
    if (!m) throw new ApiError('not_found', 'That person has no role this season.');
    await run(db().from('role_change_requests').insert({
      membership_id: m.membership_id, new_role: input.remove ? null : input.new_role, new_team_id: input.new_team_id,
      new_division_id: input.new_division_id, remove: input.remove, reason: input.reason.trim() || null, requested_by: await uid(),
    }));
  },
  async decideRoleChange(id, approve) {
    await run(db().rpc('decide_role_change', { p_request_id: id, p_approve: approve }));
  },
  async listAudit(limit = 200) {
    return run(db().from('audit_log').select('id, user_id, action, target_type, target_id, before, after, created_at')
      .order('id', { ascending: false }).limit(limit));
  },
  async listSections() {
    return run(db().from('site_sections').select('key, owner_kind, title, body, is_published, updated_at').order('key'));
  },
  async saveSection(key, patch) {
    await run(db().from('site_sections').update({ ...patch, updated_by: await uid() }).eq('key', key));
  },
  async listInquiries() {
    return run(db().from('inquiries').select('id, kind, name, email, phone, company, message, status, handled_by, created_at')
      .order('created_at', { ascending: false }).limit(300));
  },
  async markInquiry(id, handled) {
    await run(db().from('inquiries').update({ status: handled ? 'handled' : 'new', handled_by: handled ? await uid() : null }).eq('id', id));
  },
  async saveEventField(input) {
    const { id, ...row } = input;
    if (id) await run(db().from('event_fields').update(row).eq('id', id));
    else await run(db().from('event_fields').insert(row));
  },
  async deleteEventField(id) {
    await run(db().from('event_fields').delete().eq('id', id));
  },
  async listStaff(eventId) {
    return run(db().from('event_staff').select('event_id, user_id, duty').eq('event_id', eventId));
  },
  async myStaffEvents() {
    const rows = await run(db().from('event_staff').select('event_id').eq('user_id', await uid())) as { event_id: string }[];
    return [...new Set(rows.map((r) => r.event_id))];
  },
  async setStaff(eventId, userId, on) {
    if (on) await run(db().from('event_staff').upsert({ event_id: eventId, user_id: userId, duty: 'checkin' }));
    else await run(db().from('event_staff').delete().eq('event_id', eventId).eq('user_id', userId).eq('duty', 'checkin'));
  },
  async listRunOfShow(eventId) {
    return run(db().from('run_of_show').select('id, event_id, position, starts_at, ends_at, item, owner_id, notes')
      .eq('event_id', eventId).order('starts_at').order('position'));
  },
  async saveRunItem(input) {
    const { id, ...row } = input;
    if (id) await run(db().from('run_of_show').update(row).eq('id', id));
    else await run(db().from('run_of_show').insert(row));
  },
  async deleteRunItem(id) {
    await run(db().from('run_of_show').delete().eq('id', id));
  },
  async uploadImage(file, folder) {
    checkImage(file);
    const path = `${folder}/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error } = await db().storage.from('site').upload(path, file, { contentType: file.type });
    if (error) throw new ApiError('upload_failed', 'The photo didn’t upload. Try a smaller one.');
    return db().storage.from('site').getPublicUrl(path).data.publicUrl;
  },
  async listEventSpeakers(eventId) {
    return run(db().from('speakers').select('id, event_id, name, bio, photo_url, talk_title, talk_url').eq('event_id', eventId).order('created_at'));
  },
  async saveSpeaker(input) {
    const { id, ...row } = input;
    if (id) await run(db().from('speakers').update(row).eq('id', id));
    else await run(db().from('speakers').insert({ ...row, is_public: true }));
  },
  async deleteSpeaker(id) {
    await run(db().from('speakers').delete().eq('id', id));
  },
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function checkImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new ApiError('invalid_image', 'Use a JPG, PNG or WebP photo.');
  if (file.size > 5 * 1024 * 1024) throw new ApiError('invalid_image', 'Keep photos under 5 MB.');
}

export const adminApi: AdminApi = DEMO ? demoAdminApi : liveAdmin;
