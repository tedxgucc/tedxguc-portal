// Demo mode: the same API backed by sample data in this browser tab
// (sessionStorage). It mirrors the database rules closely enough to show
// each role what they would see, but it is not the security boundary.
import * as fx from '../demo/fixtures';
import { clearCache } from '../cache';
import { publicCalendarEvents } from '../calendar';
import { cairoDay } from '../format';
import { canManageEvents, canManageTeam, canManageTeamMember, memberTeamIds, isInTeam } from '../roles';
import { registrationErrors, cleanRegistrationAnswers, guestTypeFor } from '../event-registration';
import type {
  Announcement, CalendarItem, CheckInResult, Me, Member, Notification, RegistrationRow, Task, TxEvent,
} from '../types';
import { friendly } from './errors';
import { ApiError, type Api } from './types';

export const DEMO_COOKIE = 'tx-demo-user';
const KEY = 'tx-demo-v9';

type Guest = {
  id: string; event_id: string; guest_name: string; guest_email: string; guest_phone: string; guest_type: string;
  status: 'registered' | 'waitlisted' | 'cancelled'; ticket_no: string; ticket_code: string | null; status_token: string;
  answers: Record<string, string>; checked_in_at: string | null; created_at: string;
};
type Entry = (typeof fx.calendarEntries)[number];

type Store = {
  events: TxEvent[];
  guests: Guest[];
  tasks: Task[];
  comments: typeof fx.comments;
  entries: Entry[];
  announcements: (Announcement & { reads: string[] })[];
  notifications: Record<string, Notification[]>;
  invites: typeof fx.invites;
  members: Member[];
  scans: number;
  eventFields: typeof fx.eventFields;
  sections: DemoSection[];
  staff: { event_id: string; user_id: string }[];
  teams: typeof fx.teams;
  divisions: typeof fx.divisions;
  speakers: (typeof fx.speakers[number] & { is_public?: boolean })[];
  inbox: { id: string; kind: 'partner' | 'contact'; name: string; email: string; phone: string | null; company: string | null; message: string; status: 'new' | 'handled'; handled_by: string | null; created_at: string }[];
};

export type DemoSection = { key: string; owner_kind: Me['division_kind']; title: string; body: { text?: string; items?: { q: string; a: string }[] }; is_published: boolean; updated_at: string };

function fresh(): Store {
  return structuredClone({
    events: fx.events,
    guests: fx.seededGuests as Guest[],
    tasks: fx.tasks,
    comments: fx.comments,
    entries: fx.calendarEntries,
    announcements: fx.announcements.map((a) => ({ ...a, reads: [] as string[] })),
    notifications: fx.notifications,
    invites: fx.invites,
    members: fx.members,
    scans: 0,
    eventFields: fx.eventFields,
    sections: [
      { ...fx.sections.about, owner_kind: null, is_published: true, updated_at: new Date().toISOString() },
      { ...fx.sections.tedx, owner_kind: null, is_published: true, updated_at: new Date().toISOString() },
      { ...fx.sections.faq, owner_kind: null, is_published: true, updated_at: new Date().toISOString() },
      { key: 'talks', owner_kind: 'talks', title: 'Talks', body: { text: 'We find, research and coach the speakers you see on stage.' }, is_published: true, updated_at: new Date().toISOString() },
      { key: 'operations', owner_kind: 'operations', title: 'Operations', body: { text: 'Venues, suppliers, partners and every event day.' }, is_published: true, updated_at: new Date().toISOString() },
      { key: 'org_development', owner_kind: 'org_development', title: 'Organizational Development', body: { text: 'We look after the people who make TEDxGUC.' }, is_published: false, updated_at: new Date().toISOString() },
      { key: 'marketing', owner_kind: 'marketing', title: 'Marketing & Coordination', body: { text: 'Campaigns, copy, photos and design.' }, is_published: true, updated_at: new Date().toISOString() },
    ],
    staff: [],
    teams: fx.teams.map((t) => ({ ...t })),
    speakers: fx.speakers.map((x) => ({ ...x, is_public: true })),
    divisions: fx.divisions.map((d) => ({ ...d })),
    inbox: [],
  });
}

let store: Store | null = null;
function s(): Store {
  if (store) return store;
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) return (store = JSON.parse(saved));
    } catch { /* private mode: start fresh */ }
  }
  return (store = fresh());
}
function save() {
  if (typeof window === 'undefined' || !store) return;
  try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

// No artificial delays: demo data answers instantly.
const wait = (_ms?: number) => Promise.resolve();
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const fail = (code: string, msg?: string): never => { throw new ApiError(code, msg ?? friendly(code)); };
const nowIso = () => new Date().toISOString();

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function meFrom(userId: string | null): Me | null {
  const mem = s().members.find((x) => x.user_id === userId);
  if (!mem) return null;
  const t = s().teams.find((x) => x.id === mem.team_id) ?? null;
  return {
    id: mem.user_id, name: mem.name, email: fx.emailOf(mem.user_id), photo_url: mem.photo_url, role: mem.role,
    team_id: mem.team_id, team_ids: memberTeamIds(mem), team_name: mem.team, team_kind: t?.kind ?? null,
    division_id: mem.division_id, division_name: mem.division, division_kind: mem.division_kind,
  };
}
const currentMe = () => meFrom(readCookie(DEMO_COOKIE));
export const demoCurrentMe = currentMe;
export const demoTeams = () => s().teams;
export const demoMembers = () => s().members;
export const demoEvents = () => s().events;
function requireMe(): Me {
  const me = currentMe();
  if (!me) throw new ApiError('login_required', 'Pick a demo role to continue.');
  return me;
}

const teamOf = (teamId: string | null) => s().teams.find((t) => t.id === teamId) ?? null;
const canManage = (me: Me, teamId: string | null) => canManageTeam(me, teamOf(teamId));
const canSeeTeam = (me: Me, teamId: string | null) => canManage(me, teamId) || isInTeam(me, teamId);
const isListed = (e: TxEvent) => e.is_public && ['published', 'completed'].includes(e.status) && e.license_status !== 'pending';
const isOpen = (e: TxEvent) => isListed(e) && e.status === 'published' && new Date(e.starts_at) > new Date()
  && (!e.registration_closes_at || new Date(e.registration_closes_at) > new Date());
const canSeeTask = (me: Me, t: Task) =>
  canManage(me, t.team_id) || t.created_by === me.id || t.assignees.includes(me.id)
  || (!!t.requested_by_team_id && canManage(me, t.requested_by_team_id));
const isToday = (eventId?: string) => { const e = s().events.find((x) => x.id === eventId); return !!e && cairoDay(e.starts_at) === cairoDay(new Date()); };
const canScan = (me: Me, eventId?: string) => canManageEvents(me) || (me.role === 'executive' && me.team_kind === 'logistics_planning')
  || (me.role === 'associate' && me.team_kind === 'logistics_planning' && isToday(eventId))
  || (!!eventId && s().staff.some((x) => x.event_id === eventId && x.user_id === me.id));

function inAudience(me: Me, a: Announcement): boolean {
  switch (a.audience_type) {
    case 'all': return true;
    case 'division': return me.division_id === a.division_id;
    case 'team': return isInTeam(me, a.team_id) || (me.role === 'curator' && teamOf(a.team_id)?.division_id === me.division_id);
    case 'role': return me.role === a.audience_role;
  }
}

function ticketFor(e: TxEvent, n: number) {
  return `${e.ticket_prefix}-${String(n).padStart(4, '0')}`;
}

function notify(userIds: string[], title: string, link: string, type = 'info') {
  const st = s();
  for (const u of new Set(userIds)) {
    (st.notifications[u] ??= []).unshift({ id: id('n'), type, title, body: null, link, read_at: null, created_at: nowIso() });
  }
}

function applyCheckIn(g: Guest | undefined, at = nowIso()): CheckInResult {
  const base = { registration_id: g?.id ?? null, guest_name: g?.guest_name ?? null, guest_type: g?.guest_type ?? null, ticket_no: g?.ticket_no ?? null };
  if (!g) return { ...base, result: 'not_found', checked_in_at: null };
  if (g.status === 'cancelled') return { ...base, result: 'cancelled', checked_in_at: null };
  if (g.status === 'waitlisted') return { ...base, result: 'waitlisted', checked_in_at: null };
  if (g.checked_in_at) return { ...base, result: 'already_checked_in', checked_in_at: g.checked_in_at };
  g.checked_in_at = at;
  return { ...base, result: 'ok', checked_in_at: at };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const demoApi: Api = {
  // ----- Public site -----
  async listEvents(scope) {
    await wait(60);
    const now = Date.now();
    const list = s().events.filter(isListed);
    if (scope === 'upcoming') return list.filter((e) => new Date(e.starts_at).getTime() >= now && e.status === 'published').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    if (scope === 'past') return list.filter((e) => new Date(e.starts_at).getTime() < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return list.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  },
  async getEventBySlug(slug) {
    return s().events.find((e) => e.slug === slug && isListed(e)) ?? null;
  },
  async getEventFields(eventId) {
    return s().eventFields.filter((f) => f.event_id === eventId).sort((a, b) => a.position - b.position);
  },
  async listSpeakers(eventId) {
    return s().speakers.filter((x) => x.is_public !== false && (!eventId || x.event_id === eventId));
  },
  async listPartners() { return fx.partners; },
  async getSections(keys) {
    return Object.fromEntries(s().sections.filter((x) => keys.includes(x.key) && x.is_published).map((x) => [x.key, { key: x.key, title: x.title, body: x.body }]));
  },
  async getBoard() {
    return s().members.filter((x) => x.role !== 'associate').map((x) => ({ name: x.name, photo_url: null, role: x.role, division: x.division, team: x.team }));
  },
  async publicCalendar(from, to) {
    return publicCalendarEvents(s().events, from, to);
  },
  async register(input) {
    await wait(500);
    const st = s();
    const e = st.events.find((x) => x.id === input.event_id);
    if (!e || !isOpen(e)) fail('event_not_open');
    if (!input.consent) fail('consent_required');
    const issues = registrationErrors(input);
    if (Object.keys(issues).length) fail('invalid_form', Object.values(issues)[0]);
    if (!input.name.trim()) fail('invalid_name');
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('invalid_email');
    for (const f of s().eventFields.filter((x) => x.event_id === e!.id && x.required)) {
      if (!input.answers[f.id]?.trim()) fail('missing_field');
    }
    const mine = st.guests.filter((g) => g.event_id === e!.id);
    if (mine.some((g) => g.guest_email === email && g.status !== 'cancelled')) fail('already_registered');
    const taken = mine.filter((g) => g.status === 'registered').length;
    const full = e!.capacity !== null && taken >= e!.capacity;
    const token = id('tok') + id('k');
    const g: Guest = {
      id: id('r'), event_id: e!.id, guest_name: input.name.trim(), guest_email: email, guest_phone: input.phone ?? '',
      guest_type: guestTypeFor(input.answers.guest_category), status: full ? 'waitlisted' : 'registered',
      ticket_no: full ? '' : ticketFor(e!, mine.filter((x) => x.ticket_no).length + 1),
      ticket_code: full ? null : id('code'), status_token: token, answers: cleanRegistrationAnswers(input.answers), checked_in_at: null, created_at: nowIso(),
    };
    st.guests.push(g);
    save();
    return {
      status: g.status as 'registered' | 'waitlisted',
      ticket_no: g.ticket_no || null,
      waitlist_position: full ? mine.filter((x) => x.status === 'waitlisted').length + 1 : null,
      status_token: token,
    };
  },
  async getTicket(token) {
    await wait(120);
    const st = s();
    const g = st.guests.find((x) => x.status_token === token);
    if (!g) return null;
    const e = st.events.find((x) => x.id === g.event_id)!;
    const waiting = st.guests.filter((x) => x.event_id === g.event_id && x.status === 'waitlisted');
    return {
      registration_id: g.id, status: g.status, guest_name: g.guest_name, guest_type: g.guest_type, ticket_no: g.ticket_no || null,
      ticket_code: g.status === 'registered' ? g.ticket_code : null, checked_in_at: g.checked_in_at,
      waitlist_position: g.status === 'waitlisted' ? waiting.findIndex((x) => x.id === g.id) + 1 : null,
      event: { id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, venue: e.venue },
    };
  },
  async cancelTicket(token) {
    await wait(300);
    const st = s();
    const g = st.guests.find((x) => x.status_token === token);
    if (!g) fail('not_found');
    if (g!.status === 'cancelled') fail('already_cancelled');
    if (g!.checked_in_at) fail('already_checked_in');
    const wasRegistered = g!.status === 'registered';
    g!.status = 'cancelled';
    if (wasRegistered) {
      const next = st.guests.find((x) => x.event_id === g!.event_id && x.status === 'waitlisted');
      const e = st.events.find((x) => x.id === g!.event_id)!;
      if (next) {
        next.status = 'registered';
        next.ticket_code = id('code');
        next.ticket_no = ticketFor(e, st.guests.filter((x) => x.event_id === e.id && x.ticket_no).length + 1);
      }
    }
    save();
  },
  async resendTicket() { await wait(400); },
  async sendInquiry(input) {
    await wait(400);
    if (!input.consent) fail('consent_required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) fail('invalid_email');
    // Lands in the portal inbox (/portal/inbox).
    s().inbox.unshift({
      id: `q-${Date.now()}`, kind: input.kind, name: input.name.trim(), email: input.email.trim(), phone: input.phone?.trim() || null,
      company: input.company?.trim() || null, message: input.message.trim(), status: 'new', handled_by: null, created_at: new Date().toISOString(),
    });
    save();
  },

  // ----- Accounts -----
  async getMe() { return currentMe(); },
  async signInWithGoogle() { fail('demo_login'); },
  async signInWithEmail() { fail('demo_login'); },
  async signUpWithEmail() { fail('demo_login'); return false; },
  async sendPasswordReset() { await wait(300); },
  async signOut() {
    clearCache();
    document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
  },
  async updateProfile(patch) {
    const me = requireMe();
    const mem = s().members.find((x) => x.user_id === me.id)!;
    if (patch.name) mem.name = patch.name;
    if (patch.photo_url !== undefined) mem.photo_url = patch.photo_url;
    save();
  },
  async uploadAvatar(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('invalid_image', 'Use a JPG, PNG or WebP photo.');
    // Demo mode keeps the photo in this browser, so shrink it first.
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 320 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new ApiError('invalid_image', 'That photo couldn’t be read.'));
      img.src = URL.createObjectURL(file);
    });
  },
  async changePassword() { fail('demo_login', 'Passwords don’t exist in demo mode.'); },
  async rotateCalendarToken() { return 'demo' + Math.random().toString(16).slice(2).padEnd(60, '0'); },

  // ----- Structure -----
  async listDivisions() { return s().divisions; },
  async listTeams() { return s().teams; },
  async listMembers() { requireMe(); return s().members; },
  async addTeamMember(teamId, userId) {
    const actor = requireMe();
    const team = teamOf(teamId);
    const member = s().members.find((m) => m.user_id === userId);
    if (!team || !member || !canManageTeamMember(actor, team, member, 'add', s().teams)) fail('not_allowed');
    if (isInTeam(member!, teamId)) fail('already_in_team');
    member!.team_ids = [...memberTeamIds(member!), teamId];
    if (['executive', 'associate'].includes(member!.role) && !member!.team_id) {
      const division = s().divisions.find((d) => d.id === team!.division_id)!;
      Object.assign(member!, { team_id: teamId, team: team!.name, division_id: division.id, division: division.name, division_kind: division.kind });
    }
    save();
  },
  async removeTeamMember(teamId, userId) {
    const actor = requireMe();
    const team = teamOf(teamId);
    const member = s().members.find((m) => m.user_id === userId);
    if (!team || !member || !canManageTeamMember(actor, team, member, 'remove', s().teams)) fail('not_allowed');
    if (!isInTeam(member!, teamId)) fail('not_in_team');
    member!.team_ids = memberTeamIds(member!).filter((id) => id !== teamId);
    if (member!.team_id === teamId) Object.assign(member!, { team_id: null, team: null });
    save();
  },
  async listInvites() {
    const me = requireMe();
    return s().invites.filter((i) => me.role === 'chairman' || (me.role === 'curator' && i.division_id === me.division_id));
  },
  async createInvite(input) {
    await wait(400);
    const me = requireMe();
    const t = teamOf(input.team_id ?? null);
    const divisionId = t?.division_id ?? input.division_id ?? null;
    const allowed = me.role === 'chairman'
      || (me.role === 'curator' && ['executive', 'associate'].includes(input.role) && divisionId === me.division_id);
    if (!allowed) fail('not_allowed');
    s().invites.unshift({ id: id('i'), email: input.email.trim().toLowerCase(), role: input.role, team_id: input.team_id ?? null, division_id: divisionId, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(), accepted_at: null, revoked_at: null, created_at: nowIso() });
    save();
  },
  async revokeInvite(inviteId) {
    const inv = s().invites.find((i) => i.id === inviteId);
    if (inv) inv.revoked_at = nowIso();
    save();
  },

  // ----- Tasks -----
  async listTasks() {
    await wait(120);
    const me = requireMe();
    return s().tasks.filter((t) => canSeeTask(me, t));
  },
  async createTask(input) {
    await wait(300);
    const me = requireMe();
    const isRequest = !!input.requested_by_team_id;
    // Executives only work inside their own team; Curators and the Chairman send cross-team requests.
    const reqDivision = teamOf(input.requested_by_team_id ?? null)?.division_id;
    const mayRequest = me.role === 'chairman' || (me.role === 'curator' && reqDivision === me.division_id);
    if (isRequest ? !mayRequest : !canManage(me, input.team_id)) fail('not_allowed');
    for (const a of input.assignees) {
      if (!s().members.some((x) => x.user_id === a && isInTeam(x, input.team_id))) fail('assignee_not_in_team');
    }
    const task: Task = {
      id: id('k'), team_id: input.team_id, title: input.title, description: input.description ?? null, created_by: me.id,
      deadline: input.deadline ?? null, priority: input.priority, status: isRequest ? 'requested' : 'todo',
      requested_by_team_id: input.requested_by_team_id ?? null, decline_reason: null, completed_at: null, created_at: nowIso(),
      assignees: input.assignees,
    };
    s().tasks.unshift(task);
    notify(input.assignees, `New task: ${task.title}`, `/portal/tasks?task=${task.id}`, 'task_assigned');
    save();
    return task;
  },
  async updateTask(taskId, patch) {
    await wait(150);
    const me = requireMe();
    const t = s().tasks.find((x) => x.id === taskId);
    if (!t || !canSeeTask(me, t)) fail('not_found');
    const manager = canManage(me, t!.team_id);
    if (!manager) {
      const detailKeys = Object.keys(patch).filter((k) => k !== 'status');
      if (detailKeys.length) fail('only_managers_edit_task_details');
      if (t!.status === 'requested' || patch.status === 'declined' || patch.status === 'requested') fail('only_receiving_team_accepts_requests');
      if (patch.status === 'done' && t!.created_by !== me.id) fail('only_creator_or_executive_marks_done');
    }
    Object.assign(t!, patch);
    if (patch.status === 'done') t!.completed_at = nowIso();
    else if (patch.status) t!.completed_at = null;
    save();
  },
  async setAssignees(taskId, userIds) {
    const me = requireMe();
    const t = s().tasks.find((x) => x.id === taskId);
    if (!t || !canManage(me, t.team_id)) fail('not_allowed');
    t!.assignees = userIds;
    save();
  },
  async listComments(taskId) {
    return s().comments.filter((c) => c.task_id === taskId);
  },
  async addComment(taskId, body, mentions) {
    const me = requireMe();
    s().comments.push({ id: id('c'), task_id: taskId, user_id: me.id, body, created_at: nowIso() });
    notify(mentions.filter((x) => x !== me.id), 'You were mentioned on a task', `/portal/tasks?task=${taskId}`, 'task_mention');
    save();
  },

  // ----- Calendar & news -----
  async calendarFeed(from, to, teamId) {
    await wait(100);
    const me = requireMe();
    const inRange = (iso: string) => iso >= from && iso < to;
    const entries = s().entries.filter((e) => inRange(e.starts_at) && (!teamId || e.team_id === teamId)
      && (e.visibility !== 'team' || canSeeTeam(me, e.team_id)));
    const evs: CalendarItem[] = teamId ? [] : s().events.filter((e) => e.status !== 'draft' && e.status !== 'cancelled' && inRange(e.starts_at)).map((e) => ({
      source: 'event', id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, all_day: false, location: e.venue,
      online_url: null, team_id: null, visibility: isListed(e) ? 'public' : 'club', linked_type: 'event', linked_id: e.id,
    }));
    const deadlines: CalendarItem[] = s().tasks.filter((t) => t.deadline && inRange(t.deadline) && !['done', 'declined'].includes(t.status)
      && canSeeTask(me, t) && (!teamId || t.team_id === teamId)).map((t) => ({
      source: 'task_deadline', id: t.id, title: `Due: ${t.title}`, starts_at: t.deadline!, ends_at: null, all_day: false, location: null,
      online_url: null, team_id: t.team_id, visibility: 'team', linked_type: 'task', linked_id: t.id,
    }));
    const { demoCalendarMeetings } = await import('./phase2-demo');
    const meetings = demoCalendarMeetings(from, to, teamId);
    return [...entries, ...evs, ...meetings, ...deadlines].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  },
  async createCalendarEntry(input) {
    await wait(250);
    const me = requireMe();
    const ok = input.visibility === 'team' ? canManage(me, input.team_id) : me.role === 'chairman' || me.role === 'curator';
    if (!ok) fail('not_allowed');
    s().entries.push({
      source: 'entry', id: id('cal'), title: input.title, starts_at: input.starts_at, ends_at: input.ends_at ?? null,
      all_day: !!input.all_day, location: input.location ?? null, online_url: input.online_url ?? null,
      team_id: input.visibility === 'team' ? input.team_id : null, visibility: input.visibility, linked_type: null, linked_id: null,
      created_by: me.id,
    });
    save();
  },
  async deleteCalendarEntry(entryId) {
    const me = requireMe();
    const st = s();
    const e = st.entries.find((x) => x.id === entryId);
    if (!e) return;
    const ok = e.visibility === 'team' ? canManage(me, e.team_id) : e.created_by === me.id || me.role === 'chairman';
    if (!ok) fail('not_allowed');
    st.entries = st.entries.filter((x) => x.id !== entryId);
    save();
  },
  async listAnnouncements() {
    await wait(100);
    const me = requireMe();
    return s().announcements
      .filter((a) => a.author_id === me.id || me.role === 'chairman' || inAudience(me, a))
      .map(({ reads, ...a }) => ({ ...a, read_by_me: reads.includes(me.id) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  },
  async postAnnouncement(input) {
    await wait(300);
    const me = requireMe();
    const t = teamOf(input.team_id ?? null);
    const ok = me.role === 'chairman'
      || (me.role === 'curator' && ((input.audience_type === 'division' && input.division_id === me.division_id)
        || (input.audience_type === 'team' && t?.division_id === me.division_id)))
      || (me.role === 'executive' && input.audience_type === 'team' && input.team_id === me.team_id)
      || (input.audience_type === 'all' && canManageEvents(me));
    if (!ok) fail('not_allowed');
    s().announcements.unshift({
      id: id('a'), author_id: me.id, audience_type: input.audience_type, division_id: input.division_id ?? null,
      team_id: input.team_id ?? null, audience_role: input.audience_role ?? null, title: input.title, body: input.body,
      pinned: !!input.pinned, needs_confirmation: !!input.needs_confirmation, created_at: nowIso(), read_by_me: false, reads: [], image_url: input.image_url ?? null,
    });
    save();
  },
  async confirmRead(annId) {
    const me = requireMe();
    const a = s().announcements.find((x) => x.id === annId);
    if (a && !a.reads.includes(me.id)) a.reads.push(me.id);
    save();
  },
  async listNotifications() {
    const me = requireMe();
    return s().notifications[me.id] ?? [];
  },
  async markNotificationsRead() {
    const me = requireMe();
    for (const n of s().notifications[me.id] ?? []) n.read_at ??= nowIso();
    save();
  },

  // ----- Events admin & door -----
  async listAllEvents() {
    const me = requireMe();
    return s().events.filter((e) => e.status !== 'draft' || canManageEvents(me)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  },
  async saveEvent(input) {
    await wait(300);
    const me = requireMe();
    if (!canManageEvents(me)) fail('not_allowed');
    const st = s();
    if (input.id) {
      const e = st.events.find((x) => x.id === input.id)!;
      Object.assign(e, input);
      save();
      return e;
    }
    const e = { ...input, id: id('e') } as TxEvent;
    st.events.push(e);
    save();
    return e;
  },
  async listRegistrations(eventId) {
    const me = requireMe();
    if (!canManageEvents(me)) return [];
    return s().guests.filter((g) => g.event_id === eventId).map<RegistrationRow>((g) => ({
      id: g.id, guest_name: g.guest_name, guest_email: g.guest_email, guest_phone: g.guest_phone, guest_type: g.guest_type, answers: g.answers,
      status: g.status, ticket_no: g.ticket_no || null, checked_in_at: g.checked_in_at, created_at: g.created_at,
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async eventStats(eventId) {
    const me = requireMe();
    if (!canScan(me, eventId) && !canManageEvents(me)) fail('not_allowed');
    const st = s();
    const gs = st.guests.filter((g) => g.event_id === eventId);
    const e = st.events.find((x) => x.id === eventId);
    return {
      capacity: e?.capacity ?? null,
      registered: gs.filter((g) => g.status === 'registered').length,
      waitlisted: gs.filter((g) => g.status === 'waitlisted').length,
      cancelled: gs.filter((g) => g.status === 'cancelled').length,
      checked_in: gs.filter((g) => g.checked_in_at).length,
    };
  },
  async checkIn(eventId, code) {
    await wait(80);
    const me = requireMe();
    if (!canScan(me, eventId)) fail('not_allowed');
    const g = s().guests.find((x) => x.event_id === eventId && x.ticket_code === code.trim());
    const r = applyCheckIn(g);
    save();
    return r;
  },
  async checkInById(registrationId) {
    const me = requireMe();
    if (!canScan(me)) fail('not_allowed');
    const r = applyCheckIn(s().guests.find((x) => x.id === registrationId));
    save();
    return r;
  },
  async searchRegistrations(eventId, q) {
    const me = requireMe();
    if (!canScan(me, eventId)) fail('not_allowed');
    const v = q.trim().toLowerCase();
    if (v.length < 2) return [];
    return s().guests.filter((g) => g.event_id === eventId && g.status !== 'cancelled'
      && (g.guest_name.toLowerCase().includes(v) || g.guest_email === v || g.ticket_no.toLowerCase() === v))
      .slice(0, 20)
      .map((g) => ({
        registration_id: g.id, guest_name: g.guest_name,
        email_hint: `${g.guest_email.slice(0, 2)}***@${g.guest_email.split('@')[1]}`,
        ticket_no: g.ticket_no || null, guest_type: g.guest_type, status: g.status, checked_in_at: g.checked_in_at,
      }));
  },
  async getManifest(eventId) {
    const me = requireMe();
    if (!canScan(me, eventId)) fail('not_allowed');
    const gs = s().guests.filter((g) => g.event_id === eventId && g.status === 'registered' && g.ticket_code);
    return Promise.all(gs.map(async (g) => ({
      registration_id: g.id, ticket_code_hash: await sha256(g.ticket_code!), guest_name: g.guest_name,
      ticket_no: g.ticket_no, guest_type: g.guest_type, checked_in_at: g.checked_in_at,
    })));
  },
  async syncOffline(eventId, scans) {
    await wait(300);
    const me = requireMe();
    if (!canScan(me, eventId)) fail('not_allowed');
    const ordered = scans.map((sc, index) => ({ ...sc, index })).sort((a, b) => a.scanned_at.localeCompare(b.scanned_at));
    const out = ordered.map((sc) => ({
      ...applyCheckIn(s().guests.find((g) => g.event_id === eventId && g.ticket_code === sc.ticket_code), sc.scanned_at),
      index: sc.index,
    }));
    save();
    return out;
  },
};

export function demoPersonas() {
  return fx.personas.map((p) => ({ ...p, member: fx.members.find((x) => x.user_id === p.user_id)! }));
}

export function resetDemo() {
  store = fresh();
  save();
  try { sessionStorage.removeItem('tx-demo-p2-v2'); sessionStorage.removeItem('tx-demo-p2b-v2'); sessionStorage.removeItem('tx-demo-admin-v1'); sessionStorage.removeItem('tx-demo-xaccess-v1'); } catch { /* ignore */ }
}

// ----- Admin hooks (used by admin-demo.ts) -----
export function demoStore() { return s(); }
export function demoSave() { save(); }
