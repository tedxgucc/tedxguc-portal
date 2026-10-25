// Demo mode for the admin areas. Follows the same rules as the database
// (migrations 0001-0003 and 0013) so each role sees what it would see live.
import { canEditRunOfShow, canEditSection, canManageEvents, seesContactInquiries, seesPartnerInquiries } from '../roles';
import type { Me } from '../types';
import { checkImage } from './admin';
import type { AdminApi, AuditRow, Inquiry, RoleRequest, RunItem, Season, Settings } from './admin';
import { demoCurrentMe, demoSave, demoStore } from './demo-api';
import { friendly } from './errors';
import { ApiError } from './types';

const KEY = 'tx-demo-admin-v1';
const HOUR = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const fail = (code: string, msg?: string): never => { throw new ApiError(code, msg ?? friendly(code)); };

type Req = Omit<RoleRequest, 'name' | 'current_role' | 'current_team' | 'user_id'> & { user_id: string };
type Store = { settings: Settings; seasons: (Season & { chairman_id?: string })[]; requests: Req[]; audit: AuditRow[]; inquiries: Inquiry[]; run: RunItem[]; auditId: number };

function fresh(): Store {
  const mainStart = demoStore().events.find((e) => e.id === 'e-main27')?.starts_at ?? new Date().toISOString();
  const t = (min: number) => new Date(new Date(mainStart).getTime() + min * 60_000).toISOString();
  return {
    settings: {
      lates_per_absence: 2,
      absence_levels: [{ level: 2, action: 'warn_member' }, { level: 3, action: 'notify_curator' }],
      excuse_window_hours: 48, attendance_edit_window_hours: 48,
      expense_chairman_limit_egp: 5000, vat_rate: 0.14,
      cash_hold_days: 3, proof_hold_hours: 24, task_reminder_hours: 24,
      instapay_link: 'https://ipn.eg/S/tedxguc/instapay/demo', telda_link: 'https://telda.me/tedxguc-demo',
    },
    seasons: [
      { id: 's-2027', year: 2027, theme: 'Loose Ends', is_active: true, activated_at: ago(24 * 60) },
      { id: 's-2026', year: 2026, theme: 'Echo', is_active: false, activated_at: ago(24 * 420) },
    ],
    requests: [
      { id: 'rr1', membership_id: 'm-u-as-md2', user_id: 'u-as-md2', new_role: 'executive', new_team_id: 't-md', new_division_id: null, remove: false,
        reason: 'Has been leading the photo crew since the salon.', requested_by: 'u-cur-mc', status: 'pending', created_at: ago(20), decided_at: null },
    ],
    audit: [
      { id: 3, user_id: 'u-chair', action: 'update', target_type: 'settings', target_id: null, before: { key: 'expense_chairman_limit_egp', value: 4000 }, after: { key: 'expense_chairman_limit_egp', value: 5000 }, created_at: ago(30) },
      { id: 2, user_id: 'u-chair', action: 'insert', target_type: 'memberships', target_id: 'm-u-ex-md', before: null, after: { user_id: 'u-ex-md', role: 'executive', team: 'Media & Design' }, created_at: ago(24 * 9) },
      { id: 1, user_id: 'u-chair', action: 'season_rollover', target_type: 'seasons', target_id: 's-2027', before: null, after: { from: 2026, to: 2027 }, created_at: ago(24 * 60) },
    ],
    auditId: 3,
    inquiries: [
      { id: 'q1', kind: 'partner', name: 'Dina Samir', email: 'dina@brewhouse.example', phone: '+20 111 222 3333', company: 'Brewhouse Coffee', message: 'We’d love to run the coffee corner at Loose Ends. What packages do you offer?', status: 'new', handled_by: null, created_at: ago(5) },
      { id: 'q2', kind: 'contact', name: 'Omar Fathy', email: 'omar.f@example.com', phone: null, company: null, message: 'Is the main event open to students from other universities?', status: 'new', handled_by: null, created_at: ago(28) },
      { id: 'q3', kind: 'partner', name: 'Rana Youssef', email: 'rana@printly.example', phone: null, company: 'Printly', message: 'We can sponsor all event printing in exchange for logo placement.', status: 'handled', handled_by: 'u-ex-part', created_at: ago(24 * 6) },
      { id: 'q4', kind: 'contact', name: 'Hana Mostafa', email: 'hana.m@example.com', phone: null, company: null, message: 'Can I volunteer on event day without being an associate?', status: 'new', handled_by: null, created_at: ago(50) },
    ],
    run: [
      { id: 'r1', event_id: 'e-main27', position: 1, starts_at: t(-120), ends_at: t(-60), item: 'Crew call · sound and LED check', owner_id: 'u-ex-lnp', notes: 'Stage manager has the cue sheet.' },
      { id: 'r2', event_id: 'e-main27', position: 2, starts_at: t(-60), ends_at: t(0), item: 'Doors open · check-in', owner_id: 'u-cur-ops', notes: null },
      { id: 'r3', event_id: 'e-main27', position: 3, starts_at: t(0), ends_at: t(15), item: 'Opening · hosts', owner_id: 'u-ex-coach', notes: null },
      { id: 'r4', event_id: 'e-main27', position: 4, starts_at: t(15), ends_at: t(90), item: 'Session 1 · three talks', owner_id: 'u-ex-coach', notes: 'Speakers backstage 10 min before.' },
    ],
  };
}

let store: Store | null = null;
function s(): Store {
  if (store) return store;
  if (typeof window !== 'undefined') {
    try { const saved = sessionStorage.getItem(KEY); if (saved) return (store = JSON.parse(saved)); } catch { /* start fresh */ }
  }
  return (store = fresh());
}
function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(s())); } catch { /* ignore */ }
  demoSave();
}
function requireMe(): Me {
  const me = demoCurrentMe();
  if (!me) fail('login_required', 'Pick a demo role to continue.');
  return me as Me;
}
const chairOnly = () => { const me = requireMe(); if (me.role !== 'chairman') fail('not_allowed'); return me; };
const log = (me: Me, action: string, target_type: string, target_id: string | null, before: AuditRow['before'], after: AuditRow['after']) => {
  s().auditId += 1;
  s().audit.unshift({ id: s().auditId, user_id: me.id, action, target_type, target_id, before, after, created_at: new Date().toISOString() });
};
const sees = (me: Me, q: Inquiry) => (q.kind === 'partner' ? seesPartnerInquiries(me) : seesContactInquiries(me));

export const demoAdminApi: AdminApi = {
  async getSettings() { requireMe(); return { ...s().settings }; },
  async saveSetting(key, value) {
    const me = chairOnly();
    const before = s().settings[key];
    s().settings[key] = value;
    log(me, 'update', 'settings', null, { key, value: before as never }, { key, value: value as never });
    save();
  },

  async listSeasons() { requireMe(); return s().seasons.map(({ chairman_id: _c, ...x }) => x); },
  async updateSeasonTheme(id, theme) {
    const me = chairOnly();
    const season = s().seasons.find((x) => x.id === id) ?? fail('not_found');
    log(me, 'update', 'seasons', id, { theme: season.theme }, { theme: theme.trim() || null });
    season.theme = theme.trim() || null;
    save();
  },
  async prepareSeason(year, theme, chairmanId) {
    const me = chairOnly();
    if (s().seasons.some((x) => x.year === year)) fail('season_exists', `Season ${year} already exists.`);
    const id = `s-${year}`;
    s().seasons.unshift({ id, year, theme: theme.trim() || null, is_active: false, activated_at: null, chairman_id: chairmanId });
    log(me, 'season_prepared', 'seasons', id, null, { year, chairman: chairmanId, teams_copied: demoStore().teams.length });
    save();
    return id;
  },
  async activateSeason(id) {
    const me = chairOnly();
    const next = s().seasons.find((x) => x.id === id) ?? fail('not_found');
    if (next.is_active) fail('season_already_active', 'That season is already active.');
    if (!next.chairman_id) fail('new_season_needs_chairman', 'Pick the next Chairman first.');
    const old = s().seasons.find((x) => x.is_active);
    if (old) old.is_active = false;
    next.is_active = true;
    next.activated_at = new Date().toISOString();
    // Demo only: people keep their roles so the rest of the demo still works.
    log(me, 'season_rollover', 'seasons', id, null, { from: old?.year ?? null, to: next.year });
    save();
  },

  async renameTeam(id, name) {
    const me = chairOnly();
    const t = demoStore().teams.find((x) => x.id === id) ?? fail('not_found');
    if (!name.trim()) fail('invalid', 'Give the team a name.');
    if (demoStore().teams.some((x) => x.id !== id && x.name.toLowerCase() === name.trim().toLowerCase())) fail('duplicate', 'Another team already has that name.');
    log(me, 'update', 'teams', id, { name: t.name }, { name: name.trim() });
    t.name = name.trim();
    for (const m of demoStore().members) if (m.team_id === id) m.team = t.name;
    save();
  },
  async addTeam(divisionId, name, kind = 'other') {
    const me = chairOnly();
    if (!name.trim()) fail('invalid', 'Give the team a name.');
    if (demoStore().teams.some((x) => x.name.toLowerCase() === name.trim().toLowerCase())) fail('duplicate', 'Another team already has that name.');
    const id = rid('t');
    demoStore().teams.push({ id, name: name.trim(), kind, division_id: divisionId });
    log(me, 'insert', 'teams', id, null, { name: name.trim(), division: demoStore().divisions.find((d) => d.id === divisionId)?.name ?? null });
    save();
  },
  async renameDivision(id, name) {
    const me = chairOnly();
    const d = demoStore().divisions.find((x) => x.id === id) ?? fail('not_found');
    if (!name.trim()) fail('invalid', 'Give the division a name.');
    log(me, 'update', 'divisions', id, { name: d.name }, { name: name.trim() });
    d.name = name.trim();
    for (const m of demoStore().members) if (m.division_id === id) m.division = d.name;
    save();
  },

  async listRoleRequests() {
    const me = requireMe();
    return s().requests
      .filter((r) => me.role === 'chairman' || r.requested_by === me.id)
      .map((r) => {
        const m = demoStore().members.find((x) => x.user_id === r.user_id);
        return { ...r, name: m?.name ?? 'Former member', current_role: m?.role ?? null, current_team: m?.team ?? null };
      });
  },
  async requestRoleChange(input) {
    const me = requireMe();
    const m = demoStore().members.find((x) => x.user_id === input.user_id) ?? fail('not_found', 'That person has no role this season.');
    if (me.role !== 'curator' || m.division_id !== me.division_id) fail('not_allowed', 'Curators request changes for people in their own division.');
    if (!input.remove && !input.new_role) fail('invalid', 'Pick the new role.');
    if (s().requests.some((r) => r.user_id === m.user_id && r.status === 'pending')) fail('duplicate', 'There is already a pending request for this person.');
    s().requests.unshift({
      id: rid('rr'), membership_id: `m-${m.user_id}`, user_id: m.user_id, new_role: input.remove ? null : input.new_role,
      new_team_id: input.new_team_id, new_division_id: input.new_division_id, remove: input.remove, reason: input.reason.trim() || null,
      requested_by: me.id, status: 'pending', created_at: new Date().toISOString(), decided_at: null,
    });
    log(me, 'insert', 'role_change_requests', null, null, { for: m.name, new_role: input.remove ? 'remove' : input.new_role });
    save();
  },
  async decideRoleChange(id, approve) {
    const me = chairOnly();
    const r = s().requests.find((x) => x.id === id) ?? fail('not_found');
    if (r.status !== 'pending') fail('request_not_pending', 'This request was already decided.');
    const st = demoStore();
    const m = st.members.find((x) => x.user_id === r.user_id);
    if (approve && m) {
      const before = { user_id: m.user_id, role: m.role, team: m.team };
      if (r.remove) {
        st.members = st.members.filter((x) => x.user_id !== m.user_id);
      } else if (r.new_role) {
        m.role = r.new_role;
        if (r.new_role === 'curator') {
          const d = st.divisions.find((x) => x.id === (r.new_division_id ?? m.division_id));
          Object.assign(m, { team_id: null, team: null, division_id: d?.id ?? null, division: d?.name ?? null, division_kind: d?.kind ?? null });
        } else if (r.new_role !== 'chairman') {
          const t = st.teams.find((x) => x.id === (r.new_team_id ?? m.team_id));
          const d = st.divisions.find((x) => x.id === t?.division_id);
          Object.assign(m, { team_id: t?.id ?? null, team: t?.name ?? null, division_id: d?.id ?? null, division: d?.name ?? null, division_kind: d?.kind ?? null });
        }
      }
      log(me, 'update', 'memberships', r.membership_id, before, r.remove ? { user_id: m.user_id, status: 'removed' } : { user_id: m.user_id, role: m.role, team: m.team });
    }
    r.status = approve ? 'approved' : 'rejected';
    r.decided_at = new Date().toISOString();
    save();
  },

  async listAudit(limit = 200) { chairOnly(); return s().audit.slice(0, limit); },

  async listSections() { requireMe(); return demoStore().sections.map((x) => ({ ...x })); },
  async saveSection(key, patch) {
    const me = requireMe();
    const sec = demoStore().sections.find((x) => x.key === key) ?? fail('not_found');
    if (!canEditSection(me, sec.owner_kind)) fail('not_allowed', 'You can only edit your division’s sections.');
    if (!patch.title.trim()) fail('invalid', 'Give the section a title.');
    Object.assign(sec, { title: patch.title.trim(), body: patch.body, is_published: patch.is_published, updated_at: new Date().toISOString() });
    save();
  },

  async listInquiries() { const me = requireMe(); return [...demoStore().inbox, ...s().inquiries].filter((q) => sees(me, q)); },
  async markInquiry(id, handled) {
    const me = requireMe();
    const q = [...demoStore().inbox, ...s().inquiries].find((x) => x.id === id && sees(me, x)) ?? fail('not_found');
    q.status = handled ? 'handled' : 'new';
    q.handled_by = handled ? me.id : null;
    save();
  },

  async saveEventField(input) {
    const me = requireMe();
    if (!canManageEvents(me)) fail('not_allowed');
    if (!input.label.trim()) fail('invalid', 'Write the question.');
    if (input.kind === 'select' && input.options.filter(Boolean).length < 2) fail('invalid', 'A choice question needs at least two options.');
    const st = demoStore();
    const row = { ...input, label: input.label.trim(), options: input.kind === 'select' ? input.options.map((o) => o.trim()).filter(Boolean) : [] };
    if (input.id) {
      const i = st.eventFields.findIndex((f) => f.id === input.id);
      if (i < 0) fail('not_found');
      st.eventFields[i] = { ...row, id: input.id };
    } else {
      st.eventFields.push({ ...row, id: rid('f') });
    }
    save();
  },
  async deleteEventField(id) {
    const me = requireMe();
    if (!canManageEvents(me)) fail('not_allowed');
    const st = demoStore();
    st.eventFields = st.eventFields.filter((f) => f.id !== id);
    save();
  },

  async listStaff(eventId) { requireMe(); return demoStore().staff.filter((x) => x.event_id === eventId).map((x) => ({ ...x, duty: 'checkin' })); },
  async myStaffEvents() {
    const me = demoCurrentMe();
    return me ? demoStore().staff.filter((x) => x.user_id === me.id).map((x) => x.event_id) : [];
  },
  async setStaff(eventId, userId, on) {
    const me = requireMe();
    if (!canManageEvents(me)) fail('not_allowed');
    const st = demoStore();
    st.staff = st.staff.filter((x) => !(x.event_id === eventId && x.user_id === userId));
    if (on) st.staff.push({ event_id: eventId, user_id: userId });
    save();
  },

  async listRunOfShow(eventId) {
    requireMe();
    return s().run.filter((x) => x.event_id === eventId)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.position - b.position);
  },
  async saveRunItem(input) {
    const me = requireMe();
    if (!canEditRunOfShow(me)) fail('not_allowed');
    if (!input.item.trim()) fail('invalid', 'Say what happens.');
    if (input.ends_at && input.ends_at < input.starts_at) fail('invalid', 'The end time is before the start time.');
    if (input.id) {
      const i = s().run.findIndex((x) => x.id === input.id);
      if (i < 0) fail('not_found');
      s().run[i] = { ...input, id: input.id, item: input.item.trim() };
    } else {
      s().run.push({ ...input, id: rid('r'), item: input.item.trim() });
    }
    save();
  },
  async deleteRunItem(id) {
    const me = requireMe();
    if (!canEditRunOfShow(me)) fail('not_allowed');
    s().run = s().run.filter((x) => x.id !== id);
    save();
  },
  async uploadImage(file) {
    checkImage(file);
    return shrink(file);
  },
  async listEventSpeakers(eventId) { requireMe(); return demoStore().speakers.filter((x) => x.event_id === eventId); },
  async saveSpeaker(input) {
    const me = requireMe();
    if (!canManageEvents(me) && !(me.division_kind === 'talks' && (me.role === 'curator' || me.role === 'executive'))) fail('not_allowed');
    if (!input.name.trim()) fail('invalid', 'Add the speaker’s name.');
    const st = demoStore();
    if (input.id) Object.assign(st.speakers.find((x) => x.id === input.id) ?? fail('not_found'), input);
    else st.speakers.push({ ...input, id: rid('sp'), is_public: true });
    save();
  },
  async deleteSpeaker(id) {
    const me = requireMe();
    if (!canManageEvents(me)) fail('not_allowed');
    const st = demoStore();
    st.speakers = st.speakers.filter((x) => x.id !== id);
    save();
  },
};

// Demo mode keeps photos in the browser, so shrink them first.
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => reject(new ApiError('invalid_image', 'That photo couldn’t be read.'));
    img.src = URL.createObjectURL(file);
  });
}
