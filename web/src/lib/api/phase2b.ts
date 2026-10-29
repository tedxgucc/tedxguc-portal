// Phase 2 (part 2) API: recruitment (FR-4), files (FR-9), packages (FR-16).
// Supabase when configured, sample data in demo mode.
import { DEMO } from '../env';
import { db } from '../supabase';
import type { InterviewAvailability } from '../interview-availability';
import type {
  Application, ApplicationView, ApplicationDecisionContext, BoardPlan, Cycle, FileScope, HandoverRow, InterviewScore, InterviewSlot, LibFile,
  FormAnswer, Order, OrderMethod, OrderPlaced, OrderView, Package, Position, Question, SalesRow, Stage,
} from '../types';
import { friendly, toApiError } from './errors';
import { ApiError } from './types';
import { demoFilesApi, demoPackagesApi, demoRecruitmentApi } from './phase2b-demo';

export type PositionFill = { team_id: string; seats: number | null; applicants: number; is_full: boolean };
export type ApplyInput = {
  cycle_id: string; name: string; email: string; phone?: string; team_ids: string[];
  answers: Record<string, string>; cv_path?: string | null; consent: boolean; turnstile_token?: string;
};
export type PositionInput = { id?: string; cycle_id: string; team_id: string; seats: number | null; description: string | null; questions: Question[]; is_open: boolean };
export type SlotInput = { cycle_id: string; team_id: string; starts_at: string; ends_at: string; location?: string; interviewer_ids: string[] };
export type PlanInput = { id?: string; cycle_id: string; target_role: 'executive' | 'curator'; team_id: string | null; division_id: string | null; answers: Record<string, string>; submit?: boolean };
export type UploadInput = { scope: FileScope; team_id: string | null; division_id: string | null; folder: string; file: File; is_handover: boolean };
export type PackageInput = Omit<Package, 'id' | 'stock_left'> & { id?: string };
// Members sign up from the portal; name and email come from their account.
export type SignUpInput = {
  package_id: string; phone: string; quantity: number; method: OrderMethod;
  fulfilment: 'pickup' | 'delivery'; address?: string; answers: Record<string, FormAnswer>;
};
export type PickupResult = { result: 'ok' | 'already_delivered' | 'not_paid' | 'not_found'; order_no?: string; buyer_name?: string; package?: string; quantity?: number; status?: string; delivered_at?: string };

export interface RecruitmentApi {
  listCycles(): Promise<Cycle[]>;
  listPositions(cycleId?: string): Promise<Position[]>;
  /** First-choice applicants per team, and whether it's full (seats = the limit). */
  positionFill(cycleId: string): Promise<PositionFill[]>;
  saveCycle(input: Omit<Cycle, 'id' | 'rejections_released_at'> & { id?: string }): Promise<void>;
  savePosition(input: PositionInput): Promise<void>;
  uploadCv(cycleId: string, file: File, turnstileToken?: string): Promise<string>;
  apply(input: ApplyInput): Promise<{ status_token: string }>;
  getApplication(token: string): Promise<ApplicationView | null>;
  bookSlot(token: string, slotId: string): Promise<void>;
  withdraw(token: string): Promise<void>;
  listApplications(): Promise<Application[]>;
  setStage(ids: string[], stage: Exclude<Stage, 'accepted' | 'withdrawn'>): Promise<{ emailed: number; held_back: number }>;
  releaseRejections(cycleId: string): Promise<number>;
  accept(applicationId: string, teamId: string): Promise<{ team: string }>;
  decisionContext(applicationId: string): Promise<ApplicationDecisionContext>;
  refer(applicationId: string, teamId: string, notes: string): Promise<void>;
  cvUrl(path: string): Promise<string | null>;
  listSlots(): Promise<InterviewSlot[]>;
  addSlot(input: SlotInput): Promise<void>;
  getAvailability(cycleId: string, teamId: string): Promise<InterviewAvailability | null>;
  saveAvailability(cycleId: string, teamId: string, schedule: InterviewAvailability, slots: { starts_at: string; ends_at: string }[]): Promise<{ added: number; skipped: number }>;
  deleteSlot(id: string): Promise<void>;
  listScores(applicationId: string): Promise<InterviewScore[]>;
  saveScore(applicationId: string, score: number, notes: string): Promise<void>;
  listBoardPlans(): Promise<BoardPlan[]>;
  saveBoardPlan(input: PlanInput): Promise<void>;
  scoreBoardPlan(id: string, score: number, notes: string): Promise<void>;
}

export interface FilesApi {
  listFiles(): Promise<LibFile[]>;
  upload(input: UploadInput): Promise<void>;
  open(file: LibFile): Promise<string | null>;
  remove(file: LibFile): Promise<void>;
  setHandover(file: LibFile, on: boolean): Promise<void>;
  handoverStatus(): Promise<HandoverRow[]>;
}

export interface PackagesApi {
  listPackages(): Promise<Package[]>;
  savePackage(input: PackageInput): Promise<void>;
  signUp(input: SignUpInput): Promise<OrderPlaced>;
  /** My own sign-ups. */
  mySignUps(): Promise<Order[]>;
  /** A fresh private link to one of my sign-ups. */
  orderLink(orderId: string): Promise<string>;
  uploadProof(token: string, file: File): Promise<string>;
  submitProof(token: string, proofPath: string | null, reference: string | null): Promise<void>;
  getOrder(token: string): Promise<OrderView | null>;
  cancelOrder(token: string): Promise<void>;
  listOrders(): Promise<Order[]>;
  decideOrder(id: string, approve: boolean, reason?: string): Promise<void>;
  markCashPaid(id: string): Promise<void>;
  pickup(code: string): Promise<PickupResult>;
  refund(id: string, reason: string): Promise<void>;
  sales(): Promise<SalesRow[]>;
  proofUrl(path: string): Promise<string | null>;
  listApprovers(): Promise<string[]>;
  setApprover(userId: string, on: boolean): Promise<void>;
  /** Members (beyond Operations) who may scan pickup QRs. */
  listPickupScanners(packageId: string): Promise<string[]>;
  setPickupScanner(packageId: string, userId: string, on: boolean, expiresAt?: string): Promise<void>;
  canScanPickups(): Promise<boolean>;
}

// ---------------------------------------------------------------- helpers
async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error) throw new ApiError(payload.error, payload.message ?? payload.error);
    throw toApiError(error);
  }
  return data as T;
}
async function uid() {
  const { data } = await db().auth.getUser();
  if (!data.user) throw new ApiError('login_required', 'Log in again to continue.');
  return data.user.id;
}
async function signedUpload(kind: 'cv' | 'proof', extra: Record<string, unknown>, file: File) {
  const t = await invoke<{ bucket: string; path: string; token: string }>('public-forms', { action: 'upload_url', kind, ...extra });
  const { error } = await db().storage.from(t.bucket).uploadToSignedUrl(t.path, t.token, file, { contentType: file.type });
  if (error) throw new ApiError('upload_failed', 'The upload failed. Try a smaller file.');
  return t.path;
}
async function signed(bucket: string, path: string) {
  const { data } = await db().storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
const numify = <T,>(rows: T[], keys: (keyof T)[]) => rows.map((r) => { const o = { ...r }; for (const k of keys) if (o[k] !== null) (o as Record<keyof T, unknown>)[k] = Number(o[k]); return o; });

// ---------------------------------------------------------------- live
const liveRecruitment: RecruitmentApi = {
  async listCycles() {
    return run(db().from('recruitment_cycles').select('id, name, kind, opens_at, closes_at, rejections_released_at').order('opens_at', { ascending: false }));
  },
  async positionFill(cycleId) {
    return run(db().rpc('position_fill', { p_cycle_id: cycleId }));
  },
  async listPositions(cycleId) {
    let q = db().from('positions').select('id, cycle_id, team_id, seats, description, questions, is_open');
    if (cycleId) q = q.eq('cycle_id', cycleId);
    return run(q);
  },
  async saveCycle(input) {
    const { id, ...f } = input;
    await run(id ? db().from('recruitment_cycles').update(f).eq('id', id) : db().from('recruitment_cycles').insert(f));
  },
  async savePosition(input) {
    const { id, ...f } = input;
    await run(id ? db().from('positions').update(f).eq('id', id) : db().from('positions').insert(f));
  },
  uploadCv: (cycleId, file, turnstileToken) => signedUpload('cv', { cycle_id: cycleId, turnstile_token: turnstileToken }, file),
  async apply(input) {
    try { return await invoke('public-forms', { action: 'apply', ...input }); }
    catch (error) {
      if (error instanceof ApiError && error.code === 'already_applied') throw new ApiError(error.code, friendly(error.code));
      throw error;
    }
  },
  async getApplication(token) {
    return run(db().rpc('get_application_by_token', { p_status_token: token }));
  },
  async bookSlot(token, slotId) {
    await run(db().rpc('book_interview_slot', { p_status_token: token, p_slot_id: slotId }));
  },
  async withdraw(token) {
    await run(db().rpc('withdraw_application', { p_status_token: token }));
  },
  async listApplications() {
    const rows = await run<Application[]>(db().from('applications').select('id, cycle_id, applicant_name, applicant_email, applicant_phone, team_choices, answers, cv_path, stage, accepted_team_id, created_at').order('created_at', { ascending: false }));
    const referrals = await db().from('application_referrals').select('application_id, to_team_id');
    if (referrals.error && !(['42P01', 'PGRST205'].includes(referrals.error.code) && referrals.error.message.includes('application_referrals'))) throw toApiError(referrals.error);
    return rows.map((a) => ({ ...a, referred_team_ids: (referrals.data ?? []).filter((r) => r.application_id === a.id).map((r) => r.to_team_id) }));
  },
  setStage: (ids, stage) => invoke('staff-actions', { action: 'application_stage', application_ids: ids, stage }),
  async releaseRejections(cycleId) {
    return (await invoke<{ emailed: number }>('staff-actions', { action: 'release_rejections', cycle_id: cycleId })).emailed;
  },
  accept: (applicationId, teamId) => invoke('staff-actions', { action: 'accept_application', application_id: applicationId, team_id: teamId }),
  decisionContext: (applicationId) => run(db().rpc('application_decision_context', { p_application_id: applicationId })),
  async refer(applicationId, teamId, notes) {
    await run(db().rpc('refer_application', { p_application_id: applicationId, p_team_id: teamId, p_notes: notes }));
  },
  cvUrl: (path) => signed('applications', path),
  async listSlots() {
    return run(db().from('interview_slots').select('id, cycle_id, team_id, starts_at, ends_at, location, interviewer_ids, application_id').order('starts_at'));
  },
  async addSlot(input) {
    await run(db().from('interview_slots').insert(input));
  },
  async getAvailability(cycleId, teamId) {
    const { data: auth } = await db().auth.getUser();
    const row = await run<{ schedule: InterviewAvailability } | null>(db().from('interview_availability').select('schedule').eq('user_id', auth.user?.id ?? '').eq('cycle_id', cycleId).eq('team_id', teamId).maybeSingle());
    return row ? row.schedule as InterviewAvailability : null;
  },
  async saveAvailability(cycleId, teamId, schedule, slots) {
    return run(db().rpc('save_interview_availability', { p_cycle_id: cycleId, p_team_id: teamId, p_schedule: schedule, p_slots: slots }));
  },
  async deleteSlot(id) {
    await run(db().from('interview_slots').delete().eq('id', id));
  },
  async listScores(applicationId) {
    return numify(await run<InterviewScore[]>(db().from('interview_scores').select('id, application_id, interviewer_id, score, notes').eq('application_id', applicationId)), ['score']);
  },
  async saveScore(applicationId, score, notes) {
    const me = await uid();
    await run(db().from('interview_scores').upsert({ application_id: applicationId, interviewer_id: me, score, notes }, { onConflict: 'application_id,interviewer_id' }));
  },
  async listBoardPlans() {
    return numify(await run<BoardPlan[]>(db().from('board_plans').select('id, cycle_id, user_id, target_role, team_id, division_id, answers, status, submitted_at, score, reviewer_notes').order('created_at', { ascending: false })), ['score']);
  },
  async saveBoardPlan(input) {
    const me = await uid();
    const { id, submit, ...f } = input;
    if (id) await run(db().from('board_plans').update({ ...f, ...(submit ? { status: 'submitted' } : {}) }).eq('id', id));
    else {
      const row = await run<{ id: string }>(db().from('board_plans').insert({ ...f, user_id: me }).select('id').single());
      if (submit) await run(db().from('board_plans').update({ status: 'submitted' }).eq('id', row.id));
    }
  },
  async scoreBoardPlan(id, score, notes) {
    await run(db().rpc('score_board_plan', { p_plan_id: id, p_score: score, p_notes: notes }));
  },
};

const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, '_').slice(0, 120);

const liveFiles: FilesApi = {
  async listFiles() {
    return run(db().from('files').select('*').order('folder').order('name'));
  },
  async upload({ file, ...f }) {
    const me = await uid();
    const id = crypto.randomUUID();
    const storage_path = `${id}/${safeName(file.name)}`;
    await run(db().from('files').insert({ id, ...f, name: file.name, storage_path, mime_type: file.type, size_bytes: file.size, uploaded_by: me }));
    const { error } = await db().storage.from('files').upload(storage_path, file, { contentType: file.type });
    if (error) {
      await db().from('files').delete().eq('id', id);
      throw new ApiError('upload_failed', 'The upload failed. Try again.');
    }
  },
  open: (f) => signed('files', f.storage_path),
  async remove(f) {
    await db().storage.from('files').remove([f.storage_path]);
    await run(db().from('files').delete().eq('id', f.id));
  },
  async setHandover(f, on) {
    await run(db().from('files').update({ is_handover: on }).eq('id', f.id));
  },
  async handoverStatus() {
    return numify(await run<HandoverRow[]>(db().rpc('handover_status')), ['handover_files']);
  },
};

const livePackages: PackagesApi = {
  async listPackages() {
    const rows = await run<Omit<Package, 'stock_left'>[]>(db().from('packages').select('*').order('created_at'));
    return Promise.all(rows.map(async (p) => ({
      ...p, price_egp: Number(p.price_egp),
      stock_left: Number(await run(db().rpc('package_stock', { p_package_id: p.id })) ?? 0),
    })));
  },
  async savePackage(input) {
    const { id, ...f } = input;
    await run(id ? db().from('packages').update(f).eq('id', id) : db().from('packages').insert(f));
  },
  async signUp(input) {
    const r = await run<OrderPlaced>(db().rpc('member_sign_up', {
      p_package_id: input.package_id, p_phone: input.phone, p_quantity: input.quantity, p_method: input.method,
      p_fulfilment: input.fulfilment, p_address: input.address ?? null, p_answers: input.answers,
    }));
    return { ...r, total_egp: Number(r.total_egp) };
  },
  async mySignUps() {
    const { data } = await db().auth.getUser();
    if (!data.user) return [];
    return numify(await run<Order[]>(db().from('orders').select('id, order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, total_egp, method, fulfilment, delivery_address, proof_path, payment_reference, status, hold_expires_at, reject_reason, approved_by, delivered_at, created_at, user_id, answers').eq('user_id', data.user.id).order('created_at', { ascending: false })), ['total_egp']);
  },
  async orderLink(orderId) {
    return run<string>(db().rpc('member_order_link', { p_order_id: orderId }));
  },
  uploadProof: (token, file) => signedUpload('proof', { status_token: token, ext: (file.name.split('.').pop() ?? 'jpg').toLowerCase() }, file),
  async submitProof(token, proofPath, reference) {
    await invoke('public-forms', { action: 'submit_proof', status_token: token, proof_path: proofPath, reference });
  },
  async getOrder(token) {
    return run(db().rpc('get_order_by_token', { p_status_token: token }));
  },
  async cancelOrder(token) {
    await invoke('public-forms', { action: 'cancel_order', status_token: token });
  },
  async listOrders() {
    return numify(await run<Order[]>(db().from('orders').select('id, order_no, package_id, buyer_name, buyer_email, buyer_phone, quantity, total_egp, method, fulfilment, delivery_address, proof_path, payment_reference, status, hold_expires_at, reject_reason, approved_by, delivered_at, created_at, user_id, answers').order('created_at', { ascending: false })), ['total_egp']);
  },
  async decideOrder(id, approve, reason) {
    await invoke('staff-actions', { action: 'decide_order', order_id: id, approve, reason });
  },
  async markCashPaid(id) {
    await invoke('staff-actions', { action: 'mark_cash_paid', order_id: id });
  },
  async pickup(code) {
    return run(db().rpc('pickup_order', { p_pickup_code: code }));
  },
  async refund(id, reason) {
    await run(db().rpc('refund_order', { p_order_id: id, p_reason: reason }));
  },
  async sales() {
    return numify(await run<SalesRow[]>(db().rpc('package_sales', { p_package_id: null })), ['orders', 'units', 'total_egp']);
  },
  proofUrl: (path) => signed('payment-proofs', path),
  async listApprovers() {
    return (await run<{ user_id: string }[]>(db().from('package_approvers').select('user_id'))).map((r) => r.user_id);
  },
  async setApprover(userId, on) {
    await run(on ? db().from('package_approvers').insert({ user_id: userId }) : db().from('package_approvers').delete().eq('user_id', userId));
  },
  async listPickupScanners(packageId) {
    return (await run<{ user_id: string }[]>(db().from('signup_pickup_scanners').select('user_id').eq('package_id', packageId).gt('expires_at', new Date().toISOString()))).map((r) => r.user_id);
  },
  async setPickupScanner(packageId, userId, on, expiresAt) {
    await run(on ? db().from('signup_pickup_scanners').upsert({ package_id: packageId, user_id: userId, expires_at: expiresAt }, { onConflict: 'package_id,user_id' }) : db().from('signup_pickup_scanners').delete().eq('package_id', packageId).eq('user_id', userId));
  },
  async canScanPickups() {
    return !!(await run<boolean>(db().rpc('can_scan_pickups')));
  },
};

export const recruitmentApi: RecruitmentApi = DEMO ? demoRecruitmentApi : liveRecruitment;
export const filesApi: FilesApi = DEMO ? demoFilesApi : liveFiles;
export const packagesApi: PackagesApi = DEMO ? demoPackagesApi : livePackages;
