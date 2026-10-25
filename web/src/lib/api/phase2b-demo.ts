// Demo mode for recruitment, files and packages. Mirrors migrations 0007,
// 0009 and 0011 closely enough to show each stakeholder their screens.
import * as fx from '../demo/fixtures';
import type {
  Application, ApplicationView, BoardPlan, Cycle, InterviewScore, InterviewSlot, LibFile, Me, Order, OrderStatus,
  Package, Position, SlotView,
} from '../types';
import { friendly } from './errors';
import { demoCurrentMe, demoMembers } from './demo-api';
import type { FilesApi, PackagesApi, RecruitmentApi } from './phase2b';
import { ApiError } from './types';
import { canManageSignUps } from '../roles';

const KEY = 'tx-demo-p2b-v2';
const DAY = 86400_000;
const at = (days: number, hour = 14) => { const d = new Date(Date.now() + days * DAY); d.setUTCHours(Math.floor(hour) - 3, Math.round((hour % 1) * 60), 0, 0); return d.toISOString(); };
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const tok = () => `${rid('t')}${rid('k')}`.replace(/-/g, '');
const fail = (code: string, msg?: string): never => { throw new ApiError(code, msg ?? friendly(code)); };
const INSTAPAY = 'https://ipn.eg/S/tedxguc/instapay/demo';
const TELDA = 'https://telda.me/tedxguc-demo';

type App = Application & { token: string; released?: boolean };
type Ord = Order & { token: string; pickup_code: string | null };
type Store = {
  cycles: Cycle[]; positions: Position[]; apps: App[]; slots: InterviewSlot[]; scores: InterviewScore[]; plans: BoardPlan[];
  files: LibFile[]; packages: Omit<Package, 'stock_left'>[]; orders: Ord[]; approvers: string[]; counter: number;
};

function fresh(): Store {
  const q = (id: string, label: string, kind: 'text' | 'textarea' | 'url' = 'textarea', required = true) => ({ id, label, kind, required });
  const positions: Position[] = [
    { id: 'p-md', cycle_id: 'c1', team_id: 't-md', seats: 4, description: 'Shoot, edit and design everything you see from TEDxGUC.', questions: [], is_open: true },
    { id: 'p-cc', cycle_id: 'c1', team_id: 't-cc', seats: 3, description: 'Write the campaigns and the copy.', questions: [], is_open: true },
    { id: 'p-lnp', cycle_id: 'c1', team_id: 't-lnp', seats: 5, description: 'Venues, suppliers, run of show: the event happens because of you.', questions: [], is_open: true },
    { id: 'p-coach', cycle_id: 'c1', team_id: 't-coach', seats: 2, description: 'Help speakers shape and rehearse their talks.', questions: [], is_open: true },
    { id: 'p-b-md', cycle_id: 'c2', team_id: 't-md', seats: 1, description: null, questions: [q('b-md-vision', 'Your visual direction for next season')], is_open: true },
  ];
  const app = (id: string, name: string, teams: string[], stage: Application['stage'], days: number, answers: Record<string, string> = {}): App => ({
    id, cycle_id: 'c1', applicant_name: name, applicant_email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, applicant_phone: '+20 100 000 0000',
    team_choices: teams, answers: { guc_id: `${49 + (id.charCodeAt(1) % 3)}-${10000 + id.charCodeAt(1) * 37}`, major: ['Engineering (MET)', 'Management Technology', 'Applied Arts and Sciences', 'Pharmacy and Biotechnology'][id.charCodeAt(1) % 4], ...answers }, cv_path: id === 'a1' || id === 'a3' ? `cv/c1/${id}.pdf` : null, stage, accepted_team_id: null, created_at: at(-days), token: `demoapp${id}`,
  });
  return {
    cycles: [
      { id: 'c1', name: 'Associates · Spring 2027', kind: 'associates', opens_at: at(-6), closes_at: at(10, 23), rejections_released_at: null },
      { id: 'c2', name: 'Board 2028', kind: 'board', opens_at: at(-3), closes_at: at(20, 23), rejections_released_at: null },
      { id: 'c0', name: 'Associates · Fall 2026', kind: 'associates', opens_at: at(-120), closes_at: at(-100), rejections_released_at: at(-90) },
    ],
    positions,
    apps: [
      app('a1', 'Mariam Adel', ['t-md', 't-cc'], 'applied', 1, { 'md-portfolio': 'https://behance.net/mariam', 'md-why': 'I shoot every family event and edit in Premiere.' }),
      app('a2', 'Youssef Hatem', ['t-md'], 'screened', 3, { 'md-portfolio': 'https://instagram.com/yh.frames', 'md-why': 'I want to learn design from people who ship.' }),
      app('a3', 'Hana Sobhy', ['t-md'], 'interview', 4, { 'md-portfolio': 'https://dribbble.com/hana', 'md-why': 'Motion design is my thing.' }),
      app('a4', 'Karim Fathy', ['t-cc', 't-md'], 'applied', 2, { 'cc-sample': 'Loose ends are where the good stories start.' }),
      app('a5', 'Nourhan Ali', ['t-lnp'], 'interview', 5, { 'lnp-exp': 'Organised our school’s graduation for 300 people.' }),
      app('a6', 'Omar Sameh', ['t-coach'], 'rejected', 6, { 'co-why': 'Debate club captain.' }),
    ],
    slots: [
      { id: 's1', cycle_id: 'c1', team_id: 't-md', starts_at: at(2, 13), ends_at: at(2, 13.33), location: 'GUC Building B, B2.10', interviewer_ids: ['u-ex-md'], application_id: 'a3' },
      { id: 's2', cycle_id: 'c1', team_id: 't-md', starts_at: at(2, 14), ends_at: at(2, 14.33), location: 'GUC Building B, B2.10', interviewer_ids: ['u-ex-md'], application_id: null },
      { id: 's3', cycle_id: 'c1', team_id: 't-md', starts_at: at(3, 12), ends_at: at(3, 12.33), location: 'Online', interviewer_ids: ['u-ex-md', 'u-cur-mc'], application_id: null },
      { id: 's4', cycle_id: 'c1', team_id: 't-lnp', starts_at: at(2, 15), ends_at: at(2, 15.33), location: 'GUC Building D', interviewer_ids: ['u-ex-lnp'], application_id: null },
    ],
    scores: [{ id: 'sc1', application_id: 'a3', interviewer_id: 'u-cur-mc', score: 8, notes: 'Strong motion reel; ask about availability.' }],
    plans: [
      { id: 'bp1', cycle_id: 'c2', user_id: 'u-as-md3', target_role: 'executive', team_id: 't-md', division_id: null, answers: { mission: 'A team that ships one piece of content every day.', kpis: '30 posts a month, 90% on-time delivery.', 'b-md-vision': 'Bold red, black and grain.' }, status: 'submitted', submitted_at: at(-1), score: null, reviewer_notes: null },
    ],
    files: [
      { id: 'f1', scope: 'club', division_id: null, team_id: null, folder: 'Brand kit', name: 'TEDxGUC logos.zip', storage_path: 'f1/TEDxGUC logos.zip', mime_type: 'application/zip', size_bytes: 2_400_000, is_handover: false, uploaded_by: 'u-cur-mc', created_at: at(-30) },
      { id: 'f2', scope: 'club', division_id: null, team_id: null, folder: 'Brand kit', name: 'TEDx rules 2027.pdf', storage_path: 'f2/TEDx rules 2027.pdf', mime_type: 'application/pdf', size_bytes: 820_000, is_handover: false, uploaded_by: 'u-chair', created_at: at(-40) },
      { id: 'f3', scope: 'club', division_id: null, team_id: null, folder: 'Templates', name: 'Meeting minutes template.docx', storage_path: 'f3/Meeting minutes template.docx', mime_type: null, size_bytes: 40_000, is_handover: false, uploaded_by: 'u-cur-od', created_at: at(-25) },
      { id: 'f4', scope: 'team', division_id: null, team_id: 't-md', folder: 'Templates', name: 'Speaker reveal template.psd', storage_path: 'f4/Speaker reveal template.psd', mime_type: null, size_bytes: 18_000_000, is_handover: false, uploaded_by: 'u-ex-md', created_at: at(-10) },
      { id: 'f5', scope: 'team', division_id: null, team_id: 't-lnp', folder: 'Suppliers', name: 'Approved suppliers.xlsx', storage_path: 'f5/Approved suppliers.xlsx', mime_type: null, size_bytes: 60_000, is_handover: false, uploaded_by: 'u-ex-lnp', created_at: at(-12) },
      { id: 'f6', scope: 'team', division_id: null, team_id: 't-coach', folder: 'Handover', name: 'Coaching handover 2027.pdf', storage_path: 'f6/Coaching handover 2027.pdf', mime_type: 'application/pdf', size_bytes: 300_000, is_handover: true, uploaded_by: 'u-ex-coach', created_at: at(-2) },
      { id: 'f7', scope: 'board', division_id: null, team_id: null, folder: 'Board', name: 'Season budget plan.xlsx', storage_path: 'f7/Season budget plan.xlsx', mime_type: null, size_bytes: 90_000, is_handover: false, uploaded_by: 'u-chair', created_at: at(-50) },
      { id: 'f8', scope: 'division', division_id: 'd-mc', team_id: null, folder: 'Campaign plans', name: 'Loose Ends campaign plan.pdf', storage_path: 'f8/Loose Ends campaign plan.pdf', mime_type: 'application/pdf', size_bytes: 1_200_000, is_handover: false, uploaded_by: 'u-cur-mc', created_at: at(-15) },
    ],
    packages: [
      { id: 'pk1', kind: 'package', questions: [], name: 'Mid-year box', photo_url: null, contents: ['TEDxGUC tote bag', 'Notebook + pen', 'Loose Ends sticker sheet', 'Coffee voucher'], description: 'Everything you need for the second half of the semester.', price_egp: 450, stock: 40, max_per_order: 3, opens_at: at(-5), closes_at: at(25), is_active: true, pickup_info: 'TEDxGUC booth, Building C, 12–4 pm', allows_delivery: false },
      { id: 'pk2', kind: 'package', questions: [{ id: 'size', label: 'Shirt size', kind: 'choice', required: true, options: ['S', 'M', 'L', 'XL'] }], name: 'Loose Ends tee', photo_url: null, contents: ['Black tee, red X print', 'Sizes S–XL (choose at pickup)'], description: 'The 2027 shirt.', price_egp: 300, stock: 25, max_per_order: 2, opens_at: at(-5), closes_at: at(25), is_active: true, pickup_info: 'TEDxGUC booth, Building C, 12–4 pm', allows_delivery: true },
      { id: 'pk4', kind: 'trip', questions: [{ id: 'gucid', label: 'GUC ID', kind: 'short', required: true, options: [] }, { id: 'bus', label: 'Pickup point', kind: 'dropdown', required: true, options: ['GUC main gate', 'Tagamoa, Point 90', 'Nasr City, City Stars'] }, { id: 'diet', label: 'Food allergies or diet', kind: 'paragraph', required: false, options: [] }, { id: 'act', label: 'Which activities are you in for?', kind: 'checkboxes', required: false, options: ['Snorkeling', 'Quad biking', 'Beach day'] }], name: 'Ain Sokhna team trip', photo_url: null, contents: ['Bus both ways', 'Day-use resort pass', 'Lunch'], description: 'A day out for associates and the board before finals.', price_egp: 850, stock: 60, max_per_order: 1, opens_at: at(-2), closes_at: at(12), is_active: true, pickup_info: 'Bus leaves 7:00 am, be there by 6:45', allows_delivery: false },
      { id: 'pk5', kind: 'other', questions: [{ id: 'team', label: 'Your team', kind: 'short', required: true, options: [] }, { id: 'topic', label: 'Pick a session', kind: 'choice', required: true, options: ['Public speaking', 'Design basics', 'Event planning'] }], name: 'Skills workshop day', photo_url: null, contents: ['Three short sessions', 'Certificate'], description: 'Free. Places are limited.', price_egp: 0, stock: 40, max_per_order: 1, opens_at: at(-1), closes_at: at(9), is_active: true, pickup_info: null, allows_delivery: false },
      { id: 'pk3', kind: 'package', questions: [], name: 'Speaker book bundle', photo_url: null, contents: ['Three books picked by our speakers'], description: 'Coming soon.', price_egp: 650, stock: 10, max_per_order: 1, opens_at: null, closes_at: null, is_active: false, pickup_info: null, allows_delivery: false },
    ],
    orders: [
      { id: 'o1', order_no: 'PKG-2027-0001', package_id: 'pk1', buyer_name: 'Salma Tarek', buyer_email: 'salma@example.com', buyer_phone: '+20 101 111 1111', quantity: 2, total_egp: 900, method: 'instapay', fulfilment: 'pickup', delivery_address: null, proof_path: 'demo/proof-0001.jpg', payment_reference: 'IPN-7781-2290', status: 'pending_approval', hold_expires_at: null, reject_reason: null, approved_by: null, delivered_at: null, created_at: at(-1), token: 'demoorder1', pickup_code: null },
      { id: 'o2', order_no: 'PKG-2027-0002', package_id: 'pk2', buyer_name: 'Ahmed Reda', buyer_email: 'ahmed@example.com', buyer_phone: '+20 102 222 2222', quantity: 1, total_egp: 300, method: 'cash', fulfilment: 'pickup', delivery_address: null, proof_path: null, payment_reference: null, status: 'awaiting_cash', hold_expires_at: at(2), reject_reason: null, approved_by: null, delivered_at: null, created_at: at(-1), token: 'demoorder2', pickup_code: null },
      { id: 'o3', order_no: 'PKG-2027-0003', package_id: 'pk1', buyer_name: 'Laila Mounir', buyer_email: 'laila@example.com', buyer_phone: '+20 103 333 3333', quantity: 1, total_egp: 450, method: 'telda', fulfilment: 'pickup', delivery_address: null, proof_path: null, payment_reference: 'TLD-99812', status: 'approved', hold_expires_at: null, reject_reason: null, approved_by: 'u-cur-ops', delivered_at: null, created_at: at(-3), token: 'demoorder3', pickup_code: 'demopickup0003' },
      { id: 'o4', order_no: 'PKG-2027-0004', package_id: 'pk2', buyer_name: 'Mostafa Ali', buyer_email: 'mostafa@example.com', buyer_phone: '+20 104 444 4444', quantity: 1, total_egp: 300, method: 'instapay', fulfilment: 'delivery', delivery_address: 'Fifth Settlement, New Cairo', proof_path: null, payment_reference: null, status: 'pending_proof', hold_expires_at: at(0.8), reject_reason: null, approved_by: null, delivered_at: null, created_at: at(-0.2), token: 'demoorder4', pickup_code: null },
    ],
    approvers: ['u-as-lnp1'],
    counter: 4,
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

function me(): Me {
  const m = demoCurrentMe();
  if (!m) throw new ApiError('login_required', 'Pick a demo role to continue.');
  return m;
}
const team = (id: string | null) => fx.teams.find((t) => t.id === id) ?? null;
const manageTeam = (u: Me, tid: string | null) => {
  const t = team(tid);
  return !!t && (u.role === 'chairman' || (u.role === 'curator' && u.division_id === t.division_id) || (u.role === 'executive' && u.team_id === t.id));
};
const manageDivision = (u: Me, did: string | null) => u.role === 'chairman' || (u.role === 'curator' && u.division_id === did);
const canReview = (u: Me, a: Application) => a.team_choices.some((t) => manageTeam(u, t));
const canDecide = (u: Me, a: Application) => u.role === 'chairman' || a.team_choices.some((t) => manageDivision(u, team(t)?.division_id ?? null));
const isOpen = (c: Cycle) => Date.now() >= new Date(c.opens_at).getTime() && Date.now() <= new Date(c.closes_at).getTime();

function publicStage(a: App): ApplicationView['stage'] {
  const c = s().cycles.find((x) => x.id === a.cycle_id);
  switch (a.stage) {
    case 'applied': return 'received';
    case 'screened': return 'in_review';
    case 'interview': return 'interview';
    case 'accepted': return 'accepted';
    case 'withdrawn': return 'withdrawn';
    default: return c?.rejections_released_at || a.released ? 'not_selected' : 'in_review';
  }
}
const slotView = (x: InterviewSlot): SlotView => ({ slot_id: x.id, starts_at: x.starts_at, ends_at: x.ends_at, location: x.location, team: team(x.team_id)?.name ?? '' });

export const demoRecruitmentApi: RecruitmentApi = {
  async listCycles() { return [...s().cycles].sort((a, b) => b.opens_at.localeCompare(a.opens_at)); },
  async listPositions(cycleId) { return s().positions.filter((p) => !cycleId || p.cycle_id === cycleId); },
  async saveCycle(input) {
    if (me().role !== 'chairman') fail('not_allowed');
    if (input.id) Object.assign(s().cycles.find((c) => c.id === input.id)!, input);
    else s().cycles.unshift({ ...input, id: rid('c'), rejections_released_at: null });
    save();
  },
  async savePosition(input) {
    const u = me();
    if (!manageDivision(u, team(input.team_id)?.division_id ?? null)) fail('not_allowed');
    const st = s();
    const existing = input.id ? st.positions.find((p) => p.id === input.id) : st.positions.find((p) => p.cycle_id === input.cycle_id && p.team_id === input.team_id);
    if (existing) Object.assign(existing, input, { id: existing.id });
    else st.positions.push({ ...input, id: rid('p') });
    save();
  },
  async uploadCv(cycleId, file) {
    if (file.type !== 'application/pdf') fail('invalid_cv', 'Upload your CV as a PDF.');
    if (file.size > 10 * 1024 * 1024) fail('invalid_cv', 'Your CV must be under 10 MB.');
    return `cv/${cycleId}/${crypto.randomUUID()}.pdf`;
  },
  async apply(input) {
    const st = s();
    const c = st.cycles.find((x) => x.id === input.cycle_id);
    if (!c || c.kind !== 'associates' || !isOpen(c)) fail('cycle_not_open', 'Applications for this round are closed.');
    if (!input.consent) fail('consent_required');
    if (!input.name.trim()) fail('invalid_name');
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('invalid_email');
    if (input.team_ids.length < 1 || input.team_ids.length > 2 || new Set(input.team_ids).size !== input.team_ids.length) fail('invalid_team_choices', 'Pick one or two different teams.');
    for (const t of input.team_ids) {
      const p = st.positions.find((x) => x.cycle_id === c!.id && x.team_id === t && x.is_open);
      if (!p) fail('team_not_recruiting', 'One of the teams you picked is not recruiting right now.');
      for (const q of p!.questions) if (q.required && !input.answers[q.id]?.trim()) fail('missing_field', `Please answer: ${q.label}`);
    }
    if (st.apps.some((a) => a.cycle_id === c!.id && a.applicant_email === email && a.stage !== 'withdrawn')) fail('already_applied', 'You already applied in this round. Check the link we emailed you.');
    const token = tok();
    st.apps.unshift({ id: rid('a'), cycle_id: c!.id, applicant_name: input.name.trim(), applicant_email: email, applicant_phone: input.phone ?? null, team_choices: input.team_ids, answers: input.answers, cv_path: input.cv_path ?? null, stage: 'applied', accepted_team_id: null, created_at: new Date().toISOString(), token });
    save();
    return { status_token: token };
  },
  async getApplication(token) {
    const st = s();
    const a = st.apps.find((x) => x.token === token);
    if (!a) return null;
    const booked = st.slots.find((x) => x.application_id === a.id);
    return {
      application_id: a.id, applicant_name: a.applicant_name, cycle: st.cycles.find((c) => c.id === a.cycle_id)?.name ?? '',
      stage: publicStage(a), teams: a.team_choices.map((t) => team(t)?.name ?? ''),
      interview: booked ? slotView(booked) : null,
      open_slots: a.stage === 'interview' ? st.slots.filter((x) => x.cycle_id === a.cycle_id && a.team_choices.includes(x.team_id) && !x.application_id && new Date(x.starts_at).getTime() > Date.now() + 3600_000).map(slotView) : null,
    };
  },
  async bookSlot(token, slotId) {
    const st = s();
    const a = st.apps.find((x) => x.token === token);
    if (!a) fail('not_found');
    if (a!.stage !== 'interview') fail('not_invited', 'You haven’t been invited to an interview yet.');
    const slot = st.slots.find((x) => x.id === slotId);
    if (!slot || !a!.team_choices.includes(slot.team_id)) fail('slot_not_found', 'That time isn’t available.');
    if (slot!.application_id && slot!.application_id !== a!.id) fail('slot_taken', 'Someone just took that time. Pick another.');
    for (const x of st.slots) if (x.application_id === a!.id) x.application_id = null;
    slot!.application_id = a!.id;
    save();
  },
  async withdraw(token) {
    const st = s();
    const a = st.apps.find((x) => x.token === token && !['accepted', 'withdrawn'].includes(x.stage));
    if (!a) fail('not_found');
    a!.stage = 'withdrawn';
    for (const x of st.slots) if (x.application_id === a!.id) x.application_id = null;
    save();
  },
  async listApplications() {
    const u = me();
    return s().apps.filter((a) => canReview(u, a)).map(({ token: _t, released: _r, ...a }) => a);
  },
  async setStage(ids, stage) {
    const u = me();
    const st = s();
    let emailed = 0;
    for (const a of st.apps.filter((x) => ids.includes(x.id))) {
      if (!canDecide(u, a)) fail('not_allowed', 'Only the curator decides on applications.');
      if (['accepted', 'withdrawn'].includes(a.stage)) continue;
      a.stage = stage;
      if (stage !== 'interview') for (const x of st.slots) if (x.application_id === a.id) x.application_id = null;
      const released = !!st.cycles.find((c) => c.id === a.cycle_id)?.rejections_released_at;
      if (stage !== 'rejected' || released) emailed++;
    }
    save();
    return { emailed, held_back: ids.length - emailed };
  },
  async releaseRejections(cycleId) {
    const u = me();
    if (!['chairman', 'curator'].includes(u.role ?? '')) fail('not_allowed');
    const st = s();
    const c = st.cycles.find((x) => x.id === cycleId)!;
    c.rejections_released_at ??= new Date().toISOString();
    const list = st.apps.filter((a) => a.cycle_id === cycleId && a.stage === 'rejected' && !a.released);
    list.forEach((a) => { a.released = true; });
    save();
    return list.length;
  },
  async accept(applicationId, teamId) {
    const u = me();
    const a = s().apps.find((x) => x.id === applicationId);
    if (!a || !canDecide(u, a)) fail('not_allowed');
    if (!a!.team_choices.includes(teamId)) fail('team_not_chosen', 'They didn’t choose that team.');
    if (!(u.role === 'chairman' || manageDivision(u, team(teamId)?.division_id ?? null))) fail('not_allowed', 'You can only accept into your own division.');
    a!.stage = 'accepted';
    a!.accepted_team_id = teamId;
    save();
    return { team: team(teamId)?.name ?? '' };
  },
  async cvUrl() { return null; },
  async listSlots() {
    const u = me();
    return s().slots.filter((x) => manageTeam(u, x.team_id));
  },
  async addSlot(input) {
    if (!manageTeam(me(), input.team_id)) fail('not_allowed');
    s().slots.push({ ...input, id: rid('s'), location: input.location ?? null, application_id: null });
    save();
  },
  async deleteSlot(id) {
    const st = s();
    const x = st.slots.find((y) => y.id === id);
    if (!x || !manageTeam(me(), x.team_id)) fail('not_allowed');
    st.slots = st.slots.filter((y) => y.id !== id);
    save();
  },
  async listScores(applicationId) {
    const u = me();
    const a = s().apps.find((x) => x.id === applicationId);
    if (!a || !canReview(u, a)) return [];
    return s().scores.filter((x) => x.application_id === applicationId);
  },
  async saveScore(applicationId, score, notes) {
    const u = me();
    const a = s().apps.find((x) => x.id === applicationId);
    if (!a || !canReview(u, a)) fail('not_allowed');
    if (!(score >= 0 && score <= 10)) fail('invalid_score', 'Score from 0 to 10.');
    const st = s();
    const existing = st.scores.find((x) => x.application_id === applicationId && x.interviewer_id === u.id);
    if (existing) Object.assign(existing, { score, notes });
    else st.scores.push({ id: rid('sc'), application_id: applicationId, interviewer_id: u.id, score, notes });
    save();
  },
  async listBoardPlans() {
    const u = me();
    return s().plans.filter((p) => p.user_id === u.id || u.role === 'chairman');
  },
  async saveBoardPlan(input) {
    const u = me();
    const st = s();
    const c = st.cycles.find((x) => x.id === input.cycle_id);
    if (!c || c.kind !== 'board' || !isOpen(c)) fail('cycle_not_open', 'Board applications are closed.');
    let p = input.id ? st.plans.find((x) => x.id === input.id && x.user_id === u.id) : undefined;
    if (p && p.status === 'submitted') fail('locked', 'This plan was already submitted.');
    if (!p) {
      if (st.plans.some((x) => x.cycle_id === input.cycle_id && x.user_id === u.id)) fail('already_applied', 'You already have a plan in this round.');
      p = { id: rid('bp'), cycle_id: input.cycle_id, user_id: u.id, target_role: input.target_role, team_id: null, division_id: null, answers: {}, status: 'draft', submitted_at: null, score: null, reviewer_notes: null };
      st.plans.unshift(p);
    }
    Object.assign(p, { target_role: input.target_role, team_id: input.team_id, division_id: input.division_id, answers: input.answers });
    if (input.submit) { p.status = 'submitted'; p.submitted_at = new Date().toISOString(); }
    save();
  },
  async scoreBoardPlan(id, score, notes) {
    if (me().role !== 'chairman') fail('not_allowed');
    const p = s().plans.find((x) => x.id === id);
    if (!p || p.status !== 'submitted') fail('plan_not_submitted', 'Only submitted plans can be scored.');
    p!.score = score;
    p!.reviewer_notes = notes;
    save();
  },
};

// ---------------------------------------------------------------- files
const canSeeFile = (u: Me, f: Pick<LibFile, 'scope' | 'team_id' | 'division_id'>) => {
  switch (f.scope) {
    case 'club': return !!u.role;
    case 'board': return ['chairman', 'curator', 'executive'].includes(u.role ?? '');
    case 'division': return manageDivision(u, f.division_id) || u.division_id === f.division_id;
    case 'team': return manageTeam(u, f.team_id) || u.team_id === f.team_id;
  }
};
export const canWriteFile = (u: Me, f: Pick<LibFile, 'scope' | 'team_id' | 'division_id'>) => {
  switch (f.scope) {
    case 'club': case 'board': return u.role === 'chairman' || u.role === 'curator';
    case 'division': return manageDivision(u, f.division_id);
    case 'team': return manageTeam(u, f.team_id);
  }
};

export const demoFilesApi: FilesApi = {
  async listFiles() {
    const u = me();
    return s().files.filter((f) => canSeeFile(u, f));
  },
  async upload({ file, ...f }) {
    const u = me();
    if (!canWriteFile(u, f)) fail('not_allowed', 'You can’t add files there.');
    if (file.size > 50 * 1024 * 1024) fail('too_big', 'Files must be under 50 MB.');
    const id = rid('f');
    s().files.unshift({ id, ...f, name: file.name, storage_path: `${id}/${file.name}`, mime_type: file.type, size_bytes: file.size, uploaded_by: u.id, created_at: new Date().toISOString() });
    save();
  },
  async open() { return null; },
  async remove(f) {
    if (!canWriteFile(me(), f)) fail('not_allowed');
    s().files = s().files.filter((x) => x.id !== f.id);
    save();
  },
  async setHandover(f, on) {
    if (!canWriteFile(me(), f)) fail('not_allowed');
    const x = s().files.find((y) => y.id === f.id);
    if (x) x.is_handover = on;
    save();
  },
  async handoverStatus() {
    if (me().role !== 'chairman') fail('not_allowed');
    return demoMembers().filter((m) => m.role === 'curator' || m.role === 'executive').map((m) => {
      const mine = s().files.filter((f) => f.is_handover && f.uploaded_by === m.user_id);
      return { user_id: m.user_id, name: m.name, role: m.role, division: m.division, team: m.team, handover_files: mine.length, last_upload: mine[0]?.created_at ?? null };
    }).sort((a, b) => a.handover_files - b.handover_files || (a.division ?? '').localeCompare(b.division ?? ''));
  },
};

// ---------------------------------------------------------------- packages
const HELD: OrderStatus[] = ['pending_proof', 'pending_approval', 'awaiting_cash', 'approved', 'delivered'];
const reserved = (pid: string) => s().orders.filter((o) => o.package_id === pid && HELD.includes(o.status)).reduce((a, o) => a + o.quantity, 0);
const leadsOps = (u: Me) => u.role === 'chairman' || (u.role === 'curator' && u.division_kind === 'operations');
const canApprove = (u: Me) => canManageSignUps(u) || (u.division_kind === 'operations' && s().approvers.includes(u.id));
const onSale = (p: Omit<Package, 'stock_left'>) => p.is_active && (!p.opens_at || Date.now() >= new Date(p.opens_at).getTime()) && (!p.closes_at || Date.now() < new Date(p.closes_at).getTime());
function expire() {
  let changed = false;
  for (const o of s().orders) {
    if (['pending_proof', 'awaiting_cash'].includes(o.status) && o.hold_expires_at && new Date(o.hold_expires_at).getTime() < Date.now()) { o.status = 'expired'; changed = true; }
  }
  if (changed) save();
}

export const demoPackagesApi: PackagesApi = {
  async listPackages() {
    expire();
    const u = demoCurrentMe();
    if (!u?.role) return [];
    return s().packages.filter((p) => p.is_active || canManageSignUps(u)).map((p) => ({ ...p, stock_left: Math.max(p.stock - reserved(p.id), 0) }));
  },
  async savePackage(input) {
    if (!canManageSignUps(me())) fail('not_allowed', 'Only sign-up managers add or edit sign-ups.');
    const st = s();
    if (input.id) Object.assign(st.packages.find((p) => p.id === input.id)!, input);
    else st.packages.push({ ...input, id: rid('pk') });
    save();
  },
  async signUp(input) {
    expire();
    const u = me();
    const st = s();
    const p = st.packages.find((x) => x.id === input.package_id);
    if (!p || !onSale(p)) fail('package_not_on_sale', 'This sign-up is closed.');
    if (st.orders.some((o) => o.user_id === u.id && o.package_id === p!.id && !['cancelled', 'expired', 'rejected', 'refunded'].includes(o.status))) fail('already_signed_up', 'You already signed up for this.');
    for (const q of p!.questions ?? []) {
      const a = input.answers[q.id];
      if (q.required && (a === undefined || (Array.isArray(a) ? a.length === 0 : !String(a).trim()))) fail('answer_required', `Answer “${q.label}”.`);
    }
    if (input.phone.replace(/\D/g, '').length < 8) fail('invalid_phone', 'Enter a valid phone number.');
    if (input.quantity < 1 || input.quantity > p!.max_per_order) fail('invalid_quantity', `You can take 1 to ${p!.max_per_order}.`);
    if (input.fulfilment === 'delivery' && !p!.allows_delivery) fail('delivery_not_offered', 'Delivery is not available for this.');
    if (input.fulfilment === 'delivery' && !input.address?.trim()) fail('address_required', 'Add a delivery address.');
    if (p!.stock - reserved(p!.id) < input.quantity) fail('sold_out', 'Sorry, no places left.');
    st.counter += 1;
    const free = p!.price_egp === 0;
    const cash = input.method === 'cash';
    const order: Ord = {
      id: rid('o'), order_no: `PKG-2027-${String(st.counter).padStart(4, '0')}`, package_id: p!.id, buyer_name: u.name, buyer_email: u.email,
      buyer_phone: input.phone.trim(), quantity: input.quantity, total_egp: p!.price_egp * input.quantity, method: free ? 'cash' : input.method, fulfilment: input.fulfilment,
      delivery_address: input.address?.trim() || null, proof_path: null, payment_reference: null,
      status: free ? 'approved' : cash ? 'awaiting_cash' : 'pending_proof',
      hold_expires_at: free ? null : new Date(Date.now() + (cash ? 3 * DAY : DAY)).toISOString(), reject_reason: null, approved_by: null, delivered_at: null,
      created_at: new Date().toISOString(), token: tok(), pickup_code: free ? tok() : null, user_id: u.id, answers: input.answers,
    };
    st.orders.unshift(order);
    save();
    return { order_no: order.order_no, status: order.status, total_egp: order.total_egp, payment_link: free ? null : input.method === 'instapay' ? INSTAPAY : input.method === 'telda' ? TELDA : null, hold_expires_at: order.hold_expires_at, status_token: order.token };
  },
  async mySignUps() {
    expire();
    const u = demoCurrentMe();
    return u ? s().orders.filter((o) => o.user_id === u.id).map(({ token: _t, pickup_code: _p, ...o }) => o) : [];
  },
  async orderLink(orderId) {
    const u = me();
    const o = s().orders.find((x) => x.id === orderId && x.user_id === u.id) ?? fail('not_found');
    return o.token;
  },
  async uploadProof(_token, file) {
    if (file.size > 5 * 1024 * 1024) fail('invalid_proof', 'Upload a screenshot under 5 MB.');
    return `proofs/${crypto.randomUUID()}.${(file.name.split('.').pop() ?? 'jpg').toLowerCase()}`;
  },
  async submitProof(token, proofPath, reference) {
    const o = s().orders.find((x) => x.token === token);
    if (!o) fail('not_found');
    if (o!.method === 'cash' || !['pending_proof', 'pending_approval'].includes(o!.status)) fail('order_not_awaiting_proof', 'This order is not waiting for a payment screenshot.');
    if (!proofPath && !reference?.trim()) fail('proof_required', 'Upload the transfer screenshot or enter the transaction reference.');
    Object.assign(o!, { proof_path: proofPath ?? o!.proof_path, payment_reference: reference?.trim() || o!.payment_reference, status: 'pending_approval', hold_expires_at: null });
    save();
  },
  async getOrder(token) {
    expire();
    const o = s().orders.find((x) => x.token === token);
    if (!o) return null;
    const p = s().packages.find((x) => x.id === o.package_id)!;
    return {
      order_no: o.order_no, status: o.status, package: p.name, quantity: o.quantity, total_egp: o.total_egp, method: o.method, hold_expires_at: o.hold_expires_at,
      reject_reason: o.reject_reason, fulfilment: o.fulfilment, pickup_info: p.pickup_info, pickup_code: o.status === 'approved' ? o.pickup_code : null,
      payment_link: o.status === 'pending_proof' ? (o.method === 'instapay' ? INSTAPAY : o.method === 'telda' ? TELDA : null) : null,
    };
  },
  async cancelOrder(token) {
    const o = s().orders.find((x) => x.token === token && ['pending_proof', 'awaiting_cash'].includes(x.status));
    if (!o) fail('cannot_cancel', 'This order can no longer be cancelled.');
    o!.status = 'cancelled';
    o!.hold_expires_at = null;
    save();
  },
  async listOrders() {
    expire();
    if (!canApprove(me())) return [];
    return s().orders.map(({ token: _t, pickup_code: _p, ...o }) => o);
  },
  async decideOrder(id, approve, reason) {
    const u = me();
    if (!canApprove(u)) fail('not_allowed');
    const o = s().orders.find((x) => x.id === id);
    if (!o || o.status !== 'pending_approval') fail('order_not_pending', 'This order is not waiting for approval.');
    Object.assign(o!, approve ? { status: 'approved', pickup_code: rid('pick'), approved_by: u.id } : { status: 'rejected', reject_reason: reason ?? null, approved_by: u.id });
    save();
  },
  async markCashPaid(id) {
    const u = me();
    if (!canApprove(u)) fail('not_allowed');
    const o = s().orders.find((x) => x.id === id);
    if (!o || o.status !== 'awaiting_cash') fail('order_not_awaiting_cash', 'This order is not waiting for cash payment.');
    Object.assign(o!, { status: 'approved', pickup_code: rid('pick'), approved_by: u.id, hold_expires_at: null });
    save();
  },
  async pickup(code) {
    const u = me();
    if (!(canApprove(u) || u.division_kind === 'operations')) fail('not_allowed');
    const o = s().orders.find((x) => x.pickup_code === code.trim() || x.order_no.toLowerCase() === code.trim().toLowerCase());
    if (!o) return { result: 'not_found' };
    const p = s().packages.find((x) => x.id === o.package_id)!;
    if (o.status === 'delivered') return { result: 'already_delivered', order_no: o.order_no, delivered_at: o.delivered_at ?? undefined };
    if (o.status !== 'approved') return { result: 'not_paid', order_no: o.order_no, status: o.status };
    o.status = 'delivered';
    o.delivered_at = new Date().toISOString();
    save();
    return { result: 'ok', order_no: o.order_no, buyer_name: o.buyer_name, package: p.name, quantity: o.quantity };
  },
  async refund(id, reason) {
    if (!leadsOps(me())) fail('not_allowed', 'Only the Operations Curator or Chairman refunds.');
    if (!reason.trim()) fail('reason_required', 'Write why you’re refunding.');
    const o = s().orders.find((x) => x.id === id && ['approved', 'delivered'].includes(x.status));
    if (!o) fail('order_not_paid', 'Only paid orders can be refunded.');
    Object.assign(o!, { status: 'refunded', reject_reason: reason.trim() });
    save();
  },
  async sales() {
    if (!canApprove(me())) fail('not_allowed');
    const out = new Map<string, { package_id: string; package: string; method: Order['method']; orders: number; units: number; total_egp: number }>();
    for (const o of s().orders.filter((x) => ['approved', 'delivered'].includes(x.status))) {
      const p = s().packages.find((x) => x.id === o.package_id)!;
      const k = `${p.id}-${o.method}`;
      const row = out.get(k) ?? { package_id: p.id, package: p.name, method: o.method, orders: 0, units: 0, total_egp: 0 };
      row.orders++; row.units += o.quantity; row.total_egp += o.total_egp;
      out.set(k, row);
    }
    return [...out.values()];
  },
  async proofUrl() { return null; },
  async listApprovers() { return [...s().approvers]; },
  async setApprover(userId, on) {
    if (!leadsOps(me())) fail('not_allowed');
    const m = demoMembers().find((x) => x.user_id === userId);
    if (on && m?.division_kind !== 'operations') fail('approver_must_be_in_operations', 'Approvers must be in the Operations division.');
    const st = s();
    st.approvers = on ? [...new Set([...st.approvers, userId])] : st.approvers.filter((x) => x !== userId);
    save();
  },
};

export function demoOrderPickupCode(token: string) {
  return s().orders.find((o) => o.token === token)?.pickup_code ?? null;
}
