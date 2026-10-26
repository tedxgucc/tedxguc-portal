import { canSeeMeeting as meetingVisible } from '../roles';
// Demo mode for attendance and finance. Mirrors the database rules in
// migrations 0008 and 0010 closely enough to show each role its screens.
import * as fx from '../demo/fixtures';
import type {
  AttendanceStatus, Balances, Excuse, ExpenseRequest, Me, Meeting, MeetingType, MySession, RateRow, RollRow,
  Sponsorship, Transaction,
} from '../types';
import { friendly } from './errors';
import { demoCurrentMe, demoEvents, demoMembers, demoTeams } from './demo-api';
import type { AttendanceApi, FinanceApi } from './phase2';
import { ApiError } from './types';

const KEY = 'tx-demo-p2-v2';
const DAY = 86400_000;
const at = (days: number, hour = 16) => { const d = new Date(Date.now() + days * DAY); d.setUTCHours(hour - 3, 0, 0, 0); return d.toISOString(); };
const day = (days: number) => at(days).slice(0, 10);
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const fail = (code: string, msg?: string): never => { throw new ApiError(code, msg ?? friendly(code)); };
const LATES_PER_ABSENCE = 2;
const EXPENSE_LIMIT = 5000;
const VAT = 0.14;

type Att = { meeting_id: string; user_id: string; status: AttendanceStatus; via: string; note: string | null; first_marked_at: string };
type Store = {
  meetings: (Meeting & { secret: string })[];
  attendance: Att[];
  excuses: Excuse[];
  budgets: Record<string, number>;
  requests: ExpenseRequest[];
  txns: Transaction[];
  sponsorships: Sponsorship[];
  counters: Record<string, number>;
};

function mtg(idv: string, type: MeetingType, title: string, team: string | null, days: number, slot: string | null, division: string | null = null): Meeting & { secret: string } {
  return { id: idv, type, title, team_id: team, division_id: division, starts_at: at(days), ends_at: at(days, 18), slot, location: team ? 'GUC Building B' : 'GUC Main Hall', online_url: null, agenda: null, minutes: null, created_by: 'u-ex-md', secret: idv };
}

function txn(p: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'method' | 'amount_gross'>): Transaction {
  const vat = p.kind === 'bank_deposit' || p.kind === 'sponsorship' ? Math.round((p.amount_gross * VAT / (1 + VAT)) * 100) / 100 : 0;
  return {
    doc_number: null, direction: p.kind === 'cash_out' || p.kind === 'refund' || p.kind === 'bank_out' ? 'out' : 'in',
    account: p.method === 'cash' ? 'cash' : p.method === 'telda' ? 'telda' : 'bank',
    vat_amount: vat, amount_net: p.amount_gross - vat, item: null, supplier: null, description: null, team_id: null, event_id: null,
    expense_request_id: null, sponsorship_id: null, occurred_on: day(-5), fatora_path: null, expense_form_path: null, memo_path: null,
    status: 'approved', void_reason: null, created_by: 'u-ex-lnp', created_at: at(-5), ...p,
  } as Transaction;
}

function fresh(): Store {
  const md = 't-md';
  const meetings = [
    mtg('m1', 'team_meeting', 'Media & Design weekly', md, -35, 'Slot 3'),
    mtg('m2', 'team_meeting', 'Media & Design weekly', md, -28, 'Slot 3'),
    mtg('m3', 'team_meeting', 'Media & Design weekly', md, -21, 'Slot 3'),
    mtg('m4', 'team_meeting', 'Media & Design weekly', md, -14, 'Slot 3'),
    mtg('m5', 'team_meeting', 'Media & Design weekly', md, -7, 'Slot 3'),
    mtg('m6', 'team_meeting', 'Media & Design weekly', md, -0.02, 'Slot 3'),
    mtg('m7', 'team_meeting', 'Media & Design weekly', md, 7, 'Slot 3'),
    mtg('g1', 'general_assembly', 'General assembly #1', null, -24, 'Slot 5'),
    mtg('g2', 'general_assembly', 'General assembly #2', null, 3, 'Slot 5'),
    mtg('w1', 'workshop', 'Storytelling workshop', null, -10, 'Slot 4'),
    mtg('b1', 'board_meeting', 'Board meeting', null, -6, 'Slot 2'),
    mtg('l1', 'team_meeting', 'L&P weekly', 't-lnp', -6, 'Slot 1'),
  ];
  const a = (meeting_id: string, user_id: string, status: AttendanceStatus, note: string | null = null): Att =>
    ({ meeting_id, user_id, status, via: 'manual', note, first_marked_at: meetings.find((m) => m.id === meeting_id)!.starts_at });
  const attendance: Att[] = [
    a('m1', 'u-as-md1', 'attended'), a('m2', 'u-as-md1', 'attended'), a('m3', 'u-as-md1', 'late'), a('m4', 'u-as-md1', 'absent'),
    a('m5', 'u-as-md1', 'excused', 'Midterm'), a('g1', 'u-as-md1', 'attended'), a('w1', 'u-as-md1', 'late'),
    a('m1', 'u-as-md2', 'attended'), a('m2', 'u-as-md2', 'absent'), a('m3', 'u-as-md2', 'absent'), a('m4', 'u-as-md2', 'late'),
    a('m5', 'u-as-md2', 'absent'), a('g1', 'u-as-md2', 'attended'),
    a('m1', 'u-as-md3', 'attended'), a('m2', 'u-as-md3', 'attended'), a('m3', 'u-as-md3', 'attended'), a('m4', 'u-as-md3', 'attended'),
    a('m5', 'u-as-md3', 'late'), a('g1', 'u-as-md3', 'absent'),
    a('b1', 'u-ex-md', 'attended'), a('b1', 'u-ex-lnp', 'late'), a('b1', 'u-cur-mc', 'attended'),
    a('l1', 'u-as-lnp1', 'attended'), a('l1', 'u-as-lnp2', 'absent'),
  ];
  const requests: ExpenseRequest[] = [
    { id: 'x1', team_id: md, event_id: 'e-main27', requested_by: 'u-as-md1', item: 'Camera batteries (4)', amount_egp: 900, reason: 'Event-day shoot', status: 'submitted', reject_reason: null, transaction_id: null, created_at: at(-1) },
    { id: 'x2', team_id: md, event_id: 'e-main27', requested_by: 'u-as-md2', item: 'Backdrop props', amount_egp: 450, reason: null, status: 'approved', reject_reason: null, transaction_id: null, created_at: at(-3) },
    { id: 'x3', team_id: md, event_id: 'e-main27', requested_by: 'u-ex-md', item: 'LED screen rental', amount_egp: 12000, reason: 'Stage visuals for Loose Ends', status: 'awaiting_chairman', reject_reason: null, transaction_id: null, created_at: at(-2) },
    { id: 'x4', team_id: 't-lnp', event_id: 'e-main27', requested_by: 'u-ex-lnp', item: 'Gaffer tape (10 rolls)', amount_egp: 300, reason: null, status: 'purchased', reject_reason: null, transaction_id: 't3', created_at: at(-9) },
    { id: 'x5', team_id: 't-cc', event_id: null, requested_by: 'u-as-cc1', item: 'Poster printing', amount_egp: 1200, reason: null, status: 'rejected', reject_reason: 'Use the Delta Print barter deal instead.', transaction_id: null, created_at: at(-6) },
  ];
  const txns: Transaction[] = [
    // Past bank statement lines (imported history), for reports and the bank view.
    txn({ id: 'tob1', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 45000, item: 'Sponsor Vodafone Egypt', description: 'Bank statement', occurred_on: '2024-03-14', doc_number: 'OB-2026-0001', created_by: null }),
    txn({ id: 'tob2', kind: 'opening_balance', method: 'bank', direction: 'out', amount_gross: 38200, item: 'Main Event 2024 venue', description: 'Bank statement', occurred_on: '2024-05-02', doc_number: 'OB-2026-0002', created_by: null }),
    txn({ id: 'tob3', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 61000, item: 'Sponsor L Oreal Egypt', description: 'Bank statement', occurred_on: '2024-09-20', doc_number: 'OB-2026-0003', created_by: null }),
    txn({ id: 'tob4', kind: 'opening_balance', method: 'bank', direction: 'out', amount_gross: 52400, item: 'Logistics for the Main Event 2024', description: 'Bank statement', occurred_on: '2024-10-28', doc_number: 'OB-2026-0004', created_by: null }),
    txn({ id: 'tob5', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 58000, item: 'Sponsor Touch Media', description: 'Bank statement', occurred_on: '2025-02-11', doc_number: 'OB-2026-0005', created_by: null }),
    txn({ id: 'tob6', kind: 'opening_balance', method: 'bank', direction: 'out', amount_gross: 21900, item: 'Salon venue and sound', description: 'Bank statement', occurred_on: '2025-04-18', doc_number: 'OB-2026-0006', created_by: null }),
    txn({ id: 'tob7', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 70000, item: 'Student Plaza', description: 'Bank statement', occurred_on: '2025-09-30', doc_number: 'OB-2026-0007', created_by: null }),
    txn({ id: 'tob8', kind: 'opening_balance', method: 'bank', direction: 'out', amount_gross: 103965.72, item: 'Logistics for the Main Event 2025', description: 'Bank statement', occurred_on: '2025-10-02', doc_number: 'OB-2026-0008', created_by: null }),
    txn({ id: 'tob9', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 43859.65, item: 'Touch Media', description: 'Bank statement', occurred_on: '2026-01-15', doc_number: 'OB-2026-0009', created_by: null }),
    txn({ id: 'tob10', kind: 'opening_balance', method: 'bank', direction: 'in', amount_gross: 39473.68, item: 'Media Craft', description: 'Bank statement', occurred_on: '2026-06-02', doc_number: 'OB-2026-0010', created_by: null }),
    txn({ id: 't1', doc_number: 'OB-2027-0001', kind: 'opening_balance', method: 'bank', amount_gross: 25000, description: 'Carried over from the previous season', occurred_on: day(-60), created_at: at(-60) }),
    txn({ id: 't2', doc_number: 'OB-2027-0002', kind: 'opening_balance', method: 'cash', amount_gross: 3000, description: 'Carried over from the previous season', occurred_on: day(-60), created_at: at(-60) }),
    txn({ id: 't3', doc_number: 'CO-2027-0001', kind: 'cash_out', method: 'cash', amount_gross: 300, item: 'Gaffer tape (10 rolls)', supplier: 'El Nour Hardware', team_id: 't-lnp', event_id: 'e-main27', expense_request_id: 'x4', fatora_path: 'demo/fatora-0001.jpg', occurred_on: day(-8), created_at: at(-8) }),
    txn({ id: 't4', doc_number: 'CO-2027-0002', kind: 'cash_out', method: 'cash', amount_gross: 1250, item: 'Water bottles (500)', supplier: 'Nile Water', team_id: 't-lnp', event_id: 'e-main27', occurred_on: day(-4), created_at: at(-4) }),
    txn({ id: 't5', doc_number: 'DEP-2027-0001', kind: 'bank_deposit', method: 'bank', amount_gross: 57000, description: 'Nile Bank, main sponsor (1st instalment)', sponsorship_id: 's1', created_by: 'u-ex-part', occurred_on: day(-12), created_at: at(-12) }),
    txn({ id: 't6', doc_number: 'DEP-2027-0002', kind: 'bank_deposit', method: 'telda', amount_gross: 2280, description: 'Booth rental, Cairo Coffee Co.', created_by: 'u-ex-part', occurred_on: day(-3), created_at: at(-3) }),
  ];
  const sponsorships: Sponsorship[] = [
    { id: 's1', sponsor_name: 'Nile Bank', tier: 'Main', amount_egp: 114000, contract_path: 'demo/contract-nile.pdf', status: 'approved', notes: 'Two instalments', created_at: at(-20) },
    { id: 's2', sponsor_name: 'Cairo Coffee Co.', tier: 'Gold', amount_egp: 30000, contract_path: null, status: 'pending', notes: 'Waiting for signed contract', created_at: at(-4) },
  ];
  return {
    meetings, attendance,
    excuses: [{ id: 'ex1', meeting_id: 'm6', user_id: 'u-as-md2', note: 'Doctor appointment, note attached.', attachment_path: null, status: 'pending', created_at: at(-0.01) }],
    budgets: { 'd-talks': 15000, 'd-ops': 60000, 'd-od': 10000, 'd-mc': 20000 },
    requests, txns, sponsorships,
    counters: { CO: 2, DEP: 2, SP: 0 },
  };
}

let store: Store | null = null;
function s(): Store {
  if (store) return store;
  if (typeof window !== 'undefined') {
    try { const saved = sessionStorage.getItem(KEY); if (saved) return (store = JSON.parse(saved)); } catch { /* fresh */ }
  }
  return (store = fresh());
}
function save() { try { if (store && typeof window !== 'undefined') sessionStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } }
export function resetPhase2Demo() { store = fresh(); save(); }

function me(): Me {
  const m = demoCurrentMe();
  if (!m) throw new ApiError('login_required', 'Pick a demo role to continue.');
  return m;
}
const team = (tid: string | null) => fx.teams.find((t) => t.id === tid) ?? null;
const memberOf = (uid: string) => demoMembers().find((m) => m.user_id === uid);
const canManageTeam = (u: Me, tid: string | null) => {
  const t = team(tid);
  if (!t) return u.role === 'chairman';
  return u.role === 'chairman' || (u.role === 'curator' && u.division_id === t.division_id) || (u.role === 'executive' && u.team_id === t.id);
};
const canManageDivision = (u: Me, did: string | null) => u.role === 'chairman' || (u.role === 'curator' && u.division_id === did);

// ----- Attendance rules (0008) -----
function expected(m: Meeting) {
  return demoMembers().filter((x) => (m.type === 'board_meeting' ? ['executive', 'curator'].includes(x.role) : x.role === 'associate')
    && meetingVisible({ ...x, id: x.user_id, email: '', team_name: x.team, team_kind: null, division_name: x.division }, m, demoTeams()));
}
function canMark(u: Me, target: string) {
  const t = memberOf(target);
  if (!t) return false;
  if (t.role === 'associate') return canManageTeam(u, t.team_id);
  if (t.role === 'executive') return canManageDivision(u, t.division_id);
  if (t.role === 'curator') return u.role === 'chairman';
  return false;
}
function canMarkAtMeeting(u: Me, meetingId: string, target: string) {
  const m = s().meetings.find((x) => x.id === meetingId);
  const person = m && expected(m).find((x) => x.user_id === target);
  if (!m || !person) return false;
  if (!m.team_id) return canMark(u, target);
  if (person.role === 'associate') return canManageTeam(u, m.team_id);
  if (person.role === 'executive') return canManageDivision(u, team(m.team_id)?.division_id ?? null);
  return person.role === 'curator' && u.role === 'chairman';
}
function canSeeMeeting(u: Me, m: Meeting) {
  return meetingVisible(u, m, demoTeams());
}
function canWriteMeeting(u: Me, input: Pick<Meeting, 'type' | 'team_id' | 'division_id'>) {
  if (input.team_id) return canManageTeam(u, input.team_id);
  if (input.division_id) return canManageDivision(u, input.division_id);
  if (input.type === 'board_meeting') return u.role === 'chairman';
  return u.role === 'chairman' || u.role === 'curator' || (u.role === 'executive' && u.division_kind === 'org_development');
}
function level(userId: string, type?: MeetingType) {
  const st = s();
  const rows = st.attendance.filter((a) => a.user_id === userId && (!type || st.meetings.find((m) => m.id === a.meeting_id)?.type === type));
  return rows.filter((r) => r.status === 'absent').length + Math.floor(rows.filter((r) => r.status === 'late').length / LATES_PER_ABSENCE);
}
async function code(secret: string, windowNo: number) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${windowNo}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
}
function upsert(meetingId: string, userId: string, status: AttendanceStatus, via: string, note: string | null) {
  const st = s();
  const row = st.attendance.find((a) => a.meeting_id === meetingId && a.user_id === userId);
  if (row) Object.assign(row, { status, via, note });
  else st.attendance.push({ meeting_id: meetingId, user_id: userId, status, via, note, first_marked_at: new Date().toISOString() });
}

export const demoAttendanceApi: AttendanceApi = {
  async listMeetings() {
    const u = me();
    return s().meetings.filter((m) => canSeeMeeting(u, m)).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map(({ secret: _s, ...m }) => m);
  },
  async createMeeting(input) {
    const u = me();
    if (!canWriteMeeting(u, input)) fail('not_allowed');
    const m = { ...input, id: id('m'), slot: input.slot ?? null, location: input.location ?? null, online_url: input.online_url ?? null, agenda: input.agenda ?? null, minutes: null, created_by: u.id, secret: id('sec') };
    s().meetings.push(m);
    save();
    const { secret: _s, ...out } = m;
    return out;
  },
  async rollCall(meetingId) {
    const u = me();
    const m = s().meetings.find((x) => x.id === meetingId);
    if (!m) return [];
    return expected(m).filter((x) => canMarkAtMeeting(u, meetingId, x.user_id)).map<RollRow>((x) => {
      const a = s().attendance.find((r) => r.meeting_id === meetingId && r.user_id === x.user_id);
      const within = !a || u.role !== 'executive' || Date.now() <= new Date(a.first_marked_at).getTime() + 48 * 3600_000;
      return { user_id: x.user_id, name: x.name, photo_url: null, team: x.team, status: a?.status ?? null, via: a?.via ?? null, note: a?.note ?? null, can_edit: within };
    });
  },
  async submitAttendance(meetingId, marks) {
    const u = me();
    const m = s().meetings.find((x) => x.id === meetingId);
    if (!m) fail('not_found');
    for (const mk of marks) {
      if (!expected(m!).some((x) => x.user_id === mk.user_id)) fail('not_expected', 'That person isn’t expected at this meeting.');
      if (!canMarkAtMeeting(u, meetingId, mk.user_id)) fail('not_allowed');
      const a = s().attendance.find((r) => r.meeting_id === meetingId && r.user_id === mk.user_id);
      if (a && u.role === 'executive' && Date.now() > new Date(a.first_marked_at).getTime() + 48 * 3600_000) {
        fail('edit_window_closed', 'The 48-hour window to change this has passed. Ask your curator.');
      }
      upsert(meetingId, mk.user_id, mk.status, 'manual', mk.note ?? null);
    }
    save();
    return marks.length;
  },
  async meetingQr(meetingId) {
    const m = s().meetings.find((x) => x.id === meetingId);
    if (!m) fail('not_found');
    const sec = Math.floor(Date.now() / 1000);
    return { code: await code(m!.secret, Math.floor(sec / 30)), valid_for_seconds: 30 - (sec % 30) };
  },
  async meetingCheckIn(meetingId, c) {
    const u = me();
    const m = s().meetings.find((x) => x.id === meetingId);
    if (!m || !expected(m).some((x) => x.user_id === u.id)) fail('not_expected', 'You’re not on the list for this meeting.');
    const start = new Date(m!.starts_at).getTime();
    if (Date.now() < start - 30 * 60_000 || Date.now() > new Date(m!.ends_at ?? start + 3 * 3600_000).getTime()) fail('check_in_closed', 'Check-in for this meeting is closed.');
    const w = Math.floor(Date.now() / 30000);
    if (![await code(m!.secret, w), await code(m!.secret, w - 1)].includes(c.trim().toLowerCase())) fail('invalid_code', 'That code has expired. Scan the screen again.');
    const a = s().attendance.find((r) => r.meeting_id === meetingId && r.user_id === u.id);
    if (a) return { result: 'already_marked', status: a.status };
    const status: AttendanceStatus = Date.now() > start + 15 * 60_000 ? 'late' : 'attended';
    upsert(meetingId, u.id, status, 'qr', null);
    save();
    return { result: 'ok', status };
  },
  async myAttendance(type) {
    const u = me();
    const st = s();
    const rows = st.attendance.filter((a) => a.user_id === u.id)
      .map((a) => ({ a, m: st.meetings.find((m) => m.id === a.meeting_id)! }))
      .filter(({ m }) => m && (!type || m.type === type))
      .sort((x, y) => x.m.starts_at.localeCompare(y.m.starts_at));
    return rows.map<MySession>(({ a, m }, i) => ({ n: i + 1, meeting_id: m.id, title: m.title, type: m.type, starts_at: m.starts_at, slot: m.slot, status: a.status, note: a.note })).reverse();
  },
  async attendanceSummary(userId) {
    const u = me();
    const target = userId ?? u.id;
    if (target !== u.id && !canMark(u, target)) fail('not_allowed');
    const st = s();
    const types = [...new Set(st.attendance.filter((a) => a.user_id === target).map((a) => st.meetings.find((m) => m.id === a.meeting_id)!.type))];
    return {
      overall_level: level(target),
      types: types.sort().map((t) => {
        const rows = st.attendance.filter((a) => a.user_id === target && st.meetings.find((m) => m.id === a.meeting_id)?.type === t);
        const c = (x: AttendanceStatus) => rows.filter((r) => r.status === x).length;
        return { type: t, attended: c('attended'), late: c('late'), absent: c('absent'), excused: c('excused'), level: level(target, t) };
      }),
    };
  },
  async listExcuses() {
    const u = me();
    return s().excuses.filter((e) => e.user_id === u.id || canMarkAtMeeting(u, e.meeting_id, e.user_id));
  },
  async submitExcuse(meetingId, note) {
    const u = me();
    const m = s().meetings.find((x) => x.id === meetingId);
    if (!m || !expected(m).some((x) => x.user_id === u.id)) fail('not_expected', 'You’re not on the list for this meeting.');
    if (Date.now() > new Date(m!.starts_at).getTime() + 48 * 3600_000) fail('too_late', 'Excuses close 48 hours after the meeting.');
    if (s().excuses.some((e) => e.meeting_id === meetingId && e.user_id === u.id)) fail('already_sent', 'You already sent an excuse for this one.');
    s().excuses.unshift({ id: id('ex'), meeting_id: meetingId, user_id: u.id, note, attachment_path: null, status: 'pending', created_at: new Date().toISOString() });
    save();
  },
  async decideExcuse(exId, accept) {
    const u = me();
    const e = s().excuses.find((x) => x.id === exId);
    if (!e || !canMarkAtMeeting(u, e.meeting_id, e.user_id)) fail('not_allowed');
    if (e!.status !== 'pending') fail('already_decided', 'Already decided.');
    e!.status = accept ? 'accepted' : 'rejected';
    if (accept) upsert(e!.meeting_id, e!.user_id, 'excused', 'excuse', e!.note);
    save();
  },
  async attendanceRates(teamId, divisionId) {
    const u = me();
    const ok = (teamId && canManageTeam(u, teamId)) || (!teamId && divisionId && canManageDivision(u, divisionId)) || (!teamId && !divisionId && u.role === 'chairman');
    if (!ok) fail('not_allowed');
    const st = s();
    return demoMembers().filter((x) => ['associate', 'executive'].includes(x.role) && (!teamId || x.team_id === teamId) && (!divisionId || x.division_id === divisionId))
      .map<RateRow>((x) => {
        const rows = st.attendance.filter((a) => a.user_id === x.user_id);
        const c = (k: AttendanceStatus) => rows.filter((r) => r.status === k).length;
        const base = rows.length - c('excused');
        return { user_id: x.user_id, name: x.name, team: x.team, sessions: rows.length, attended: c('attended'), late: c('late'), absent: c('absent'), excused: c('excused'),
          rate: base ? Math.round((1000 * (c('attended') + c('late'))) / base) / 10 : null, level: level(x.user_id) };
      });
  },
};

// ----- Finance rules (0010) -----
const isAdmin = (u: Me) => u.role === 'chairman' || (u.role === 'curator' && u.division_kind === 'operations');
const isLp = (u: Me) => u.role === 'executive' && u.team_kind === 'logistics_planning';
const isP = (u: Me) => u.role === 'executive' && u.team_kind === 'partnerships';
const canWriteKind = (u: Me, k: string) => (k === 'cash_out' ? isAdmin(u) || isLp(u) : ['bank_deposit', 'sponsorship'].includes(k) ? isAdmin(u) || isP(u) : k === 'bank_out' ? isAdmin(u) : false);
// Only L&P Executives ask; only they, the Ops Curator and the Chairman see requests.
const canSeeRequest = (u: Me, r: ExpenseRequest) => r.requested_by === u.id || isAdmin(u) || isLp(u);
const nextDoc = (prefix: string) => { const st = s(); st.counters[prefix] = (st.counters[prefix] ?? 0) + 1; return `${prefix}-2027-${String(st.counters[prefix]).padStart(4, '0')}`; };

export const demoFinanceApi: FinanceApi = {
  async listExpenseRequests() {
    const u = me();
    return s().requests.filter((r) => canSeeRequest(u, r));
  },
  async createExpenseRequest(input) {
    const u = me();
    if (!isLp(u) || u.team_id !== input.team_id) fail('not_allowed', 'Only L&P Executives request money.');
    if (!(input.amount_egp > 0)) fail('invalid_amount', 'Enter an amount above zero.');
    s().requests.unshift({ id: id('x'), team_id: input.team_id, event_id: input.event_id ?? null, requested_by: u.id, item: input.item, amount_egp: input.amount_egp, reason: input.reason ?? null, status: 'submitted', reject_reason: null, transaction_id: null, created_at: new Date().toISOString() });
    save();
  },
  async decideExpenseRequest(rid, approve, reason) {
    const u = me();
    const r = s().requests.find((x) => x.id === rid);
    if (!r) fail('not_found');
    if (r!.status === 'submitted') { if (!isAdmin(u)) fail('not_allowed', 'The Operations Curator decides money requests.'); }
    else if (r!.status === 'awaiting_chairman') { if (u.role !== 'chairman') fail('not_allowed'); }
    else fail('already_decided', 'Already decided.');
    r!.status = !approve ? 'rejected' : r!.amount_egp > EXPENSE_LIMIT && u.role !== 'chairman' ? 'awaiting_chairman' : 'approved';
    r!.reject_reason = approve ? null : reason ?? null;
    save();
    return { status: r!.status };
  },
  async cancelExpenseRequest(rid) {
    const u = me();
    const r = s().requests.find((x) => x.id === rid && x.requested_by === u.id && ['submitted', 'awaiting_chairman'].includes(x.status));
    if (!r) fail('cannot_cancel', 'This request can no longer be cancelled.');
    r!.status = 'cancelled';
    save();
  },
  async divisionBudget(did) {
    const u = me();
    if (!canManageDivision(u, did) && !isAdmin(u)) fail('not_allowed');
    const st = s();
    const inDiv = (tid: string | null) => team(tid)?.division_id === did;
    const spent = st.txns.filter((t) => t.kind === 'cash_out' && t.status === 'approved' && inDiv(t.team_id)).reduce((a, t) => a + t.amount_net, 0);
    const reqs = st.requests.filter((r) => inDiv(r.team_id));
    const sum = (f: (r: ExpenseRequest) => boolean) => reqs.filter(f).reduce((a, r) => a + r.amount_egp, 0);
    const budget = st.budgets[did] ?? null;
    const approved = sum((r) => r.status === 'approved');
    return { budget, spent, approved_not_bought: approved, pending: sum((r) => ['submitted', 'awaiting_chairman'].includes(r.status)), remaining: budget === null ? null : budget - spent - approved };
  },
  async setBudget(did, amount) {
    if (me().role !== 'chairman') fail('not_allowed');
    s().budgets[did] = amount;
    save();
  },
  async listTransactions() {
    const u = me();
    return s().txns.filter((t) => isAdmin(u) || canWriteKind(u, t.kind)).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at));
  },
  async listAllTransactions() {
    return [...(await demoFinanceApi.listTransactions())].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at));
  },
  async createTransaction(input) {
    const u = me();
    if (!canWriteKind(u, input.kind)) fail('not_allowed');
    if (!(input.amount_gross > 0)) fail('invalid_amount', 'Enter an amount above zero.');
    const st = s();
    let teamId = input.team_id ?? null;
    if (input.expense_request_id) {
      const r = st.requests.find((x) => x.id === input.expense_request_id);
      if (!r || r.status !== 'approved') fail('expense_request_not_approved', 'That request isn’t approved yet.');
      teamId = teamId ?? r!.team_id;
    }
    const vatApplies = input.kind === 'bank_out' ? false : input.vat_applies ?? input.kind !== 'cash_out';
    if (input.kind === 'bank_out') input = { ...input, method: 'bank' };
    const t = txn({
      id: id('t'), kind: input.kind, method: input.method, amount_gross: input.amount_gross,
      doc_number: nextDoc(input.kind === 'cash_out' ? 'CO' : input.kind === 'bank_deposit' ? 'DEP' : input.kind === 'bank_out' ? 'BO' : 'SP'),
      item: input.item ?? null, supplier: input.supplier ?? null, description: input.description ?? null, team_id: teamId,
      event_id: input.event_id ?? null, expense_request_id: input.expense_request_id ?? null, sponsorship_id: input.sponsorship_id ?? null,
      occurred_on: input.occurred_on ?? new Date().toISOString().slice(0, 10), created_by: u.id, created_at: new Date().toISOString(),
    });
    if (!vatApplies) { t.vat_amount = 0; t.amount_net = t.amount_gross; }
    st.txns.unshift(t);
    if (input.expense_request_id) {
      const r = st.requests.find((x) => x.id === input.expense_request_id)!;
      r.status = 'purchased';
      r.transaction_id = t.id;
    }
    save();
    return t;
  },
  async attachFatora(txnId, file) {
    const t = s().txns.find((x) => x.id === txnId);
    if (!t || t.status === 'void') fail('not_found');
    t!.fatora_path = `demo/${file.name}`;
    save();
  },
  async openFile() { return null; },
  async voidTransaction(tid, reason) {
    const u = me();
    const t = s().txns.find((x) => x.id === tid);
    if (!t) fail('not_found');
    if (!(isAdmin(u) || (t!.created_by === u.id && canWriteKind(u, t!.kind)))) fail('not_allowed');
    if (!reason.trim()) fail('reason_required', 'Write why you’re voiding it.');
    if (t!.status === 'void') fail('already_void', 'Already void.');
    t!.status = 'void';
    t!.void_reason = reason.trim();
    for (const r of s().requests) if (r.transaction_id === tid) { r.status = 'approved'; r.transaction_id = null; }
    save();
  },
  async balances() {
    if (!isAdmin(me())) fail('not_allowed');
    const ok = s().txns.filter((t) => t.status === 'approved');
    const bal = (acc: string) => ok.filter((t) => t.account === acc).reduce((a, t) => a + (t.direction === 'in' ? t.amount_net : -t.amount_net), 0);
    const b: Balances = {
      bank: bal('bank'), telda: bal('telda'), cash: bal('cash'),
      vat_collected: ok.filter((t) => t.direction === 'in').reduce((a, t) => a + t.vat_amount, 0),
      cash_outs_missing_fatora: ok.filter((t) => t.kind === 'cash_out' && !t.fatora_path).length,
      pending_sponsorships: s().sponsorships.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount_egp, 0),
    };
    return b;
  },
  async makePaperwork(tid) {
    const u = me();
    const t = s().txns.find((x) => x.id === tid);
    if (!t || t.kind !== 'cash_out' || !(isAdmin(u) || isLp(u))) fail('not_allowed');
    if (t!.status === 'void') fail('voided', 'This entry was voided.');
    const req = s().requests.find((r) => r.id === t!.expense_request_id);
    // The PDF library loads only when someone actually makes paperwork.
    const { paperworkBlobs } = await import('./paperwork');
    const urls = await paperworkBlobs(t!, {
      team: team(t!.team_id)?.name ?? null,
      event: demoEvents().find((e) => e.id === t!.event_id)?.title ?? null,
      requested_by: req ? memberOf(req.requested_by)?.name ?? null : null,
      recorded_by: t!.created_by ? memberOf(t!.created_by)?.name ?? null : null,
    });
    t!.expense_form_path = 'demo/expense-form.pdf';
    t!.memo_path = 'demo/memo.pdf';
    save();
    return urls;
  },
  async listSponsorships() {
    const u = me();
    if (!(isAdmin(u) || isP(u))) return [];
    return s().sponsorships;
  },
  async createSponsorship(input) {
    const u = me();
    if (!(isAdmin(u) || isP(u))) fail('not_allowed');
    s().sponsorships.unshift({ id: id('s'), sponsor_name: input.sponsor_name, tier: input.tier ?? null, amount_egp: input.amount_egp, contract_path: null, status: 'pending', notes: input.notes ?? null, created_at: new Date().toISOString() });
    save();
  },
  async setSponsorshipStatus(sid, status) {
    const u = me();
    if (!(isAdmin(u) || isP(u))) fail('not_allowed');
    const sp = s().sponsorships.find((x) => x.id === sid);
    if (sp) sp.status = status;
    save();
  },
  async reconcile(month, account, statement) {
    if (!isAdmin(me())) fail('not_allowed');
    const end = new Date(new Date(`${month.slice(0, 7)}-01T00:00:00Z`).getTime() + 32 * DAY).toISOString().slice(0, 7) + '-01';
    const book = s().txns.filter((t) => t.status === 'approved' && t.account === account && t.occurred_on < end)
      .reduce((a, t) => a + (t.direction === 'in' ? t.amount_net : -t.amount_net), 0);
    return { month: `${month.slice(0, 7)}-01`, account, statement_balance: statement, book_balance: book, difference: statement - book };
  },
};

export async function demoSaveMinutes(meetingId: string, minutes: string) {
  const u = me();
  const m = s().meetings.find((x) => x.id === meetingId);
  if (!m || !canWriteMeeting(u, m)) fail('not_allowed');
  m!.minutes = minutes;
  save();
}

export function demoCanWriteMeeting(m: Pick<Meeting, 'type' | 'team_id' | 'division_id'>) {
  const u = demoCurrentMe();
  return !!u && canWriteMeeting(u, m);
}

export function demoCalendarMeetings(from: string, to: string, teamId?: string | null) {
  const u = me();
  return s().meetings.filter((m) => canSeeMeeting(u, m) && m.starts_at < to && (m.ends_at ?? m.starts_at) >= from && (!teamId || m.team_id === teamId))
    .map((m) => ({ source: 'meeting' as const, id: m.id, title: m.title, starts_at: m.starts_at, ends_at: m.ends_at,
      all_day: false, location: m.location, online_url: m.online_url, team_id: m.team_id,
      visibility: m.team_id ? 'team' as const : 'club' as const, linked_type: 'meeting', linked_id: m.id }));
}
