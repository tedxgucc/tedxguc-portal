// Phase 2 API: meetings & attendance (FR-7) and finance (FR-12).
// Same pattern as the Phase 1 API: Supabase when configured, sample data
// in demo mode. The database enforces every rule; the demo mirrors them.
import { DEMO } from '../env';
import { db } from '../supabase';
import type {
  AttendanceStatus, AttendanceSummary, Balances, BudgetStatus, Excuse, ExpenseRequest, Meeting, MeetingType,
  MySession, PayMethod, RateRow, Reconciliation, RollRow, Sponsorship, Transaction, TxnKind, MoneyAccount,
} from '../types';
import { friendly, toApiError } from './errors';
import { ApiError } from './types';
import { demoAttendanceApi, demoFinanceApi } from './phase2-demo';

export type NewMeeting = {
  type: MeetingType; title: string; team_id: string | null; division_id: string | null;
  starts_at: string; ends_at: string | null; slot?: string; location?: string; online_url?: string; agenda?: string;
};
export type Mark = { user_id: string; status: AttendanceStatus; note?: string };
export type NewExpenseRequest = { team_id: string; item: string; amount_egp: number; reason?: string; event_id?: string | null };
export type NewTransaction = {
  kind: Extract<TxnKind, 'cash_out' | 'bank_deposit' | 'sponsorship' | 'bank_out'>;
  method: PayMethod; amount_gross: number; item?: string; supplier?: string; description?: string;
  team_id?: string | null; event_id?: string | null; expense_request_id?: string | null; sponsorship_id?: string | null;
  occurred_on?: string; vat_applies?: boolean;
};

export interface AttendanceApi {
  listMeetings(): Promise<Meeting[]>;
  createMeeting(input: NewMeeting): Promise<Meeting>;
  rollCall(meetingId: string): Promise<RollRow[]>;
  submitAttendance(meetingId: string, marks: Mark[]): Promise<number>;
  meetingQr(meetingId: string): Promise<{ code: string; valid_for_seconds: number }>;
  meetingCheckIn(meetingId: string, code: string): Promise<{ result: 'ok' | 'already_marked'; status: AttendanceStatus }>;
  myAttendance(type?: MeetingType | null): Promise<MySession[]>;
  attendanceSummary(userId?: string | null): Promise<AttendanceSummary>;
  listExcuses(): Promise<Excuse[]>;
  submitExcuse(meetingId: string, note: string): Promise<void>;
  decideExcuse(id: string, accept: boolean): Promise<void>;
  attendanceRates(teamId: string | null, divisionId: string | null): Promise<RateRow[]>;
}

export type BankEdit = { direction: 'in' | 'out'; amount: number; date: string; description: string; vat: boolean; reason: string };

export interface FinanceApi {
  listExpenseRequests(): Promise<ExpenseRequest[]>;
  createExpenseRequest(input: NewExpenseRequest): Promise<void>;
  decideExpenseRequest(id: string, approve: boolean, reason?: string): Promise<{ status: string }>;
  cancelExpenseRequest(id: string): Promise<void>;
  divisionBudget(divisionId: string): Promise<BudgetStatus>;
  setBudget(divisionId: string, amount: number): Promise<void>;
  listTransactions(): Promise<Transaction[]>;
  /** Every entry I may see, all years (for the bank history and reports). */
  listAllTransactions(): Promise<Transaction[]>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  attachFatora(txnId: string, file: File): Promise<void>;
  openFile(path: string): Promise<string | null>;
  voidTransaction(id: string, reason: string): Promise<void>;
  editBankTransaction(id: string, patch: BankEdit): Promise<void>;
  balances(): Promise<Balances>;
  makePaperwork(txnId: string): Promise<{ expense_form_url: string | null; memo_url: string | null }>;
  listSponsorships(): Promise<Sponsorship[]>;
  createSponsorship(input: { sponsor_name: string; tier?: string; amount_egp: number; notes?: string }): Promise<void>;
  setSponsorshipStatus(id: string, status: Sponsorship['status']): Promise<void>;
  reconcile(month: string, account: MoneyAccount, statement: number): Promise<Reconciliation>;
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
const num = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]) => {
  const out = { ...row };
  for (const k of keys) out[k] = (row[k] === null ? null : Number(row[k])) as T[keyof T];
  return out;
};

const MEETING_COLS = 'id, type, title, team_id, division_id, starts_at, ends_at, slot, location, online_url, agenda, minutes, created_by';
const TXN_NUMS: (keyof Transaction)[] = ['amount_gross', 'vat_amount', 'amount_net'];

const liveAttendance: AttendanceApi = {
  async listMeetings() {
    return run(db().from('meetings').select(MEETING_COLS).order('starts_at', { ascending: false }).limit(200));
  },
  async createMeeting(input) {
    return run(db().from('meetings').insert(input).select(MEETING_COLS).single());
  },
  async rollCall(meetingId) {
    return run(db().rpc('meeting_roll_call', { p_meeting_id: meetingId }));
  },
  async submitAttendance(meetingId, marks) {
    return run(db().rpc('submit_attendance', { p_meeting_id: meetingId, p_marks: marks }));
  },
  async meetingQr(meetingId) {
    return run(db().rpc('meeting_qr', { p_meeting_id: meetingId }));
  },
  async meetingCheckIn(meetingId, code) {
    return run(db().rpc('meeting_check_in', { p_meeting_id: meetingId, p_code: code }));
  },
  async myAttendance(type) {
    const rows = await run<MySession[]>(db().rpc('my_attendance', { p_type: type ?? null }));
    return rows.map((r) => ({ ...r, n: Number(r.n) }));
  },
  async attendanceSummary(userId) {
    return run(db().rpc('attendance_summary', { p_user: userId ?? null }));
  },
  async listExcuses() {
    return run(db().from('excuses').select('id, meeting_id, user_id, note, attachment_path, status, created_at').order('created_at', { ascending: false }));
  },
  async submitExcuse(meetingId, note) {
    const me = await uid();
    await run(db().from('excuses').insert({ meeting_id: meetingId, user_id: me, note }));
  },
  async decideExcuse(id, accept) {
    await run(db().rpc('decide_excuse', { p_excuse_id: id, p_accept: accept }));
  },
  async attendanceRates(teamId, divisionId) {
    const rows = await run<RateRow[]>(db().rpc('attendance_rates', { p_team: teamId, p_division: divisionId }));
    return rows.map((r) => num(r, ['sessions', 'attended', 'late', 'absent', 'excused', 'rate', 'level']));
  },
};

const liveFinance: FinanceApi = {
  async listExpenseRequests() {
    const rows = await run<ExpenseRequest[]>(db().from('expense_requests')
      .select('id, team_id, event_id, requested_by, item, amount_egp, reason, status, reject_reason, transaction_id, created_at')
      .order('created_at', { ascending: false }));
    return rows.map((r) => num(r, ['amount_egp']));
  },
  async createExpenseRequest(input) {
    const me = await uid();
    await run(db().from('expense_requests').insert({ ...input, requested_by: me }));
  },
  async decideExpenseRequest(id, approve, reason) {
    return run(db().rpc('decide_expense_request', { p_id: id, p_approve: approve, p_reason: reason ?? null }));
  },
  async cancelExpenseRequest(id) {
    await run(db().rpc('cancel_expense_request', { p_id: id }));
  },
  async divisionBudget(divisionId) {
    const b = await run<Record<string, number | null>>(db().rpc('division_budget_status', { p_division_id: divisionId }));
    return num(b, ['budget', 'spent', 'approved_not_bought', 'pending', 'remaining']) as BudgetStatus;
  },
  async setBudget(divisionId, amount) {
    await run(db().from('division_budgets').upsert({ division_id: divisionId, amount_egp: amount }));
  },
  async listTransactions() {
    const rows = await run<Transaction[]>(db().from('transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(500));
    return rows.map((r) => num(r, TXN_NUMS));
  },
  async listAllTransactions() {
    const out: Transaction[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const rows = await run<Transaction[]>(db().from('transactions').select('*').order('occurred_on', { ascending: true }).order('created_at', { ascending: true }).range(from, from + 999));
      out.push(...rows.map((r) => num(r, TXN_NUMS)));
      if (rows.length < 1000) break;
    }
    return out;
  },
  async createTransaction(input) {
    const me = await uid();
    const row = await run<Transaction>(db().from('transactions').insert({ ...input, created_by: me }).select('*').single());
    return num(row, TXN_NUMS);
  },
  async attachFatora(txnId, file) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `fatora/${txnId}/${Date.now()}.${ext}`;
    const { error } = await db().storage.from('finance').upload(path, file, { contentType: file.type });
    if (error) throw new ApiError('upload_failed', 'The upload failed. Try a smaller photo or PDF.');
    await run(db().from('transactions').update({ fatora_path: path }).eq('id', txnId));
  },
  async openFile(path) {
    const { data } = await db().storage.from('finance').createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  },
  async editBankTransaction(id, patch) {
    await run(db().rpc('edit_bank_transaction', { p_id: id, p_direction: patch.direction, p_amount: patch.amount,
      p_date: patch.date, p_description: patch.description, p_vat: patch.vat, p_reason: patch.reason }));
  },
  async voidTransaction(id, reason) {
    await run(db().rpc('void_transaction', { p_id: id, p_reason: reason }));
  },
  async balances() {
    const b = await run<Record<string, number>>(db().rpc('finance_balances'));
    return num(b, ['bank', 'telda', 'cash', 'vat_collected', 'cash_outs_missing_fatora', 'pending_sponsorships']) as Balances;
  },
  async makePaperwork(txnId) {
    const { data, error } = await db().functions.invoke('finance-docs', { body: { transaction_id: txnId } });
    if (error) throw toApiError(error);
    return data;
  },
  async listSponsorships() {
    const rows = await run<Sponsorship[]>(db().from('sponsorships').select('id, sponsor_name, tier, amount_egp, contract_path, status, notes, created_at').order('created_at', { ascending: false }));
    return rows.map((r) => num(r, ['amount_egp']));
  },
  async createSponsorship(input) {
    const me = await uid();
    await run(db().from('sponsorships').insert({ ...input, created_by: me }));
  },
  async setSponsorshipStatus(id, status) {
    await run(db().from('sponsorships').update({ status }).eq('id', id));
  },
  async reconcile(month, account, statement) {
    const r = await run<Reconciliation>(db().rpc('record_reconciliation', { p_month: month, p_account: account, p_statement_balance: statement }));
    return num(r, ['statement_balance', 'book_balance', 'difference']);
  },
};

export const attendanceApi: AttendanceApi = DEMO ? demoAttendanceApi : liveAttendance;
export const financeApi: FinanceApi = DEMO ? demoFinanceApi : liveFinance;

export { friendly };

// Minutes are saved straight on the meeting (FR-7.2).
export async function saveMinutes(meetingId: string, minutes: string) {
  if (DEMO) {
    const { demoSaveMinutes } = await import('./phase2-demo');
    return demoSaveMinutes(meetingId, minutes);
  }
  await run(db().from('meetings').update({ minutes }).eq('id', meetingId));
}
