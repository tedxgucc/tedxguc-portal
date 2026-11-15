// Orientation before associates recruitment (migration 0061).
// Not an event: two (usually) days where GUC students meet the club and
// the teams, then apply when the round opens.
import { DEMO } from '../env';
import { db } from '../supabase';
import { teams as demoTeams } from '../demo/fixtures';
import { demoCurrentMe } from './demo-api';
import { recruitmentApi } from './phase2b';
import { friendly, toApiError } from './errors';
import { ApiError } from './types';
import type { Cycle } from '../types';

export type OrientationDay = { id: string; cycle_id: string; starts_at: string; ends_at: string; location: string | null; capacity: number | null };
export type DayCount = { day_id: string; signed_up: number; capacity: number | null; is_full: boolean };
export type OrientationSignup = { id: string; cycle_id: string; day_id: string; name: string; guc_id: string; email: string; team_ids: string[]; attended: boolean; created_at: string };
export type OrientationInput = { day_id: string; name: string; guc_id: string; email: string; team_ids: string[]; consent: boolean; turnstile_token?: string };
export type DayInput = Omit<OrientationDay, 'id'> & { id?: string };

export const GUC_ID_RE = /^\d{1,3}-\d{3,6}$/;
export const GUC_EMAIL_RE = /^[^@\s]+@student\.guc\.edu\.eg$/i;

export interface OrientationApi {
  /** The round being planned: the next associates round that has orientation days still to come. */
  upcoming(): Promise<{ cycle: Cycle; days: OrientationDay[]; counts: DayCount[] } | null>;
  listDays(cycleId: string): Promise<OrientationDay[]>;
  saveDay(input: DayInput): Promise<void>;
  deleteDay(id: string): Promise<void>;
  signUp(input: OrientationInput): Promise<void>;
  listSignups(cycleId: string): Promise<OrientationSignup[]>;
  setAttended(id: string, attended: boolean): Promise<void>;
}

async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}

async function pickUpcoming(days: OrientationDay[], counts: (cycleId: string) => Promise<DayCount[]>) {
  const now = Date.now();
  const future = days.filter((d) => Date.parse(d.ends_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!future.length) return null;
  const cycle = (await recruitmentApi.listCycles()).find((c) => c.id === future[0].cycle_id && c.kind === 'associates');
  if (!cycle) return null;
  return { cycle, days: days.filter((d) => d.cycle_id === cycle.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), counts: await counts(cycle.id) };
}

const live: OrientationApi = {
  async upcoming() {
    const days = await run<OrientationDay[]>(db().from('orientation_days').select('id, cycle_id, starts_at, ends_at, location, capacity').gte('ends_at', new Date().toISOString()));
    if (!days.length) return null;
    const all = await run<OrientationDay[]>(db().from('orientation_days').select('id, cycle_id, starts_at, ends_at, location, capacity').in('cycle_id', [...new Set(days.map((d) => d.cycle_id))]));
    return pickUpcoming(all, (id) => run(db().rpc('orientation_day_counts', { p_cycle_id: id })));
  },
  async listDays(cycleId) {
    return run(db().from('orientation_days').select('id, cycle_id, starts_at, ends_at, location, capacity').eq('cycle_id', cycleId).order('starts_at'));
  },
  async saveDay({ id, ...f }) {
    await run(id ? db().from('orientation_days').update(f).eq('id', id) : db().from('orientation_days').insert(f));
  },
  async deleteDay(id) { await run(db().from('orientation_days').delete().eq('id', id)); },
  async signUp(input) {
    const { data, error } = await db().functions.invoke('public-forms', { body: { action: 'orientation', ...input } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
      if (payload?.error) throw new ApiError(payload.error, payload.message ?? friendly(payload.error));
      throw toApiError(error);
    }
    return data;
  },
  async listSignups(cycleId) {
    return run(db().from('orientation_signups').select('id, cycle_id, day_id, name, guc_id, email, team_ids, attended, created_at').eq('cycle_id', cycleId).order('created_at'));
  },
  async setAttended(id, attended) { await run(db().from('orientation_signups').update({ attended }).eq('id', id)); },
};

// ---------------------------------------------------------------- demo
const KEY = 'tx-demo-orientation-v1';
type Store = { days: OrientationDay[]; signups: OrientationSignup[] };
let mem: Store | null = null;
const fail = (code: string): never => { throw new ApiError(code, friendly(code)); };
const at = (days: number, hour: number) => { const d = new Date(Date.now() + days * 86400_000); d.setUTCHours(hour - 2, 0, 0, 0); return d.toISOString(); };
async function store(): Promise<Store> {
  if (mem) return mem;
  try { const raw = localStorage.getItem(KEY); if (raw) return (mem = JSON.parse(raw)); } catch { /* private window */ }
  const cycle = (await recruitmentApi.listCycles()).find((c) => c.kind === 'associates');
  const days: OrientationDay[] = cycle ? [
    { id: 'od-1', cycle_id: cycle.id, starts_at: at(5, 12), ends_at: at(5, 15), location: 'GUC, Building C, Hall C7.01', capacity: 120 },
    { id: 'od-2', cycle_id: cycle.id, starts_at: at(6, 12), ends_at: at(6, 15), location: 'GUC, Building C, Hall C7.01', capacity: 120 },
  ] : [];
  const signups: OrientationSignup[] = cycle ? [
    { id: 'os-1', cycle_id: cycle.id, day_id: 'od-1', name: 'Salma Hany', guc_id: '58-10321', email: 'salma.hany@student.guc.edu.eg', team_ids: ['t-md', 't-cc'], attended: false, created_at: at(-1, 10) },
    { id: 'os-2', cycle_id: cycle.id, day_id: 'od-2', name: 'Omar Tarek', guc_id: '58-11872', email: 'omar.tarek@student.guc.edu.eg', team_ids: ['t-coach'], attended: false, created_at: at(-1, 11) },
  ] : [];
  return (mem = { days, signups });
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* ignore */ } };
const isChair = () => demoCurrentMe()?.role === 'chairman';
const demoCounts = async (cycleId: string): Promise<DayCount[]> => {
  const s = await store();
  return s.days.filter((d) => d.cycle_id === cycleId).map((d) => {
    const n = s.signups.filter((x) => x.day_id === d.id).length;
    return { day_id: d.id, signed_up: n, capacity: d.capacity, is_full: d.capacity !== null && n >= d.capacity };
  });
};

const demo: OrientationApi = {
  async upcoming() { return pickUpcoming((await store()).days, demoCounts); },
  async listDays(cycleId) { return (await store()).days.filter((d) => d.cycle_id === cycleId).sort((a, b) => a.starts_at.localeCompare(b.starts_at)); },
  async saveDay(input) {
    if (!isChair()) fail('not_allowed');
    const s = await store();
    if (input.id) Object.assign(s.days.find((d) => d.id === input.id)!, input);
    else s.days.push({ ...input, id: `od-${Math.random().toString(36).slice(2, 8)}` });
    save();
  },
  async deleteDay(id) {
    if (!isChair()) fail('not_allowed');
    const s = await store();
    s.days = s.days.filter((d) => d.id !== id); s.signups = s.signups.filter((x) => x.day_id !== id); save();
  },
  async signUp(input) {
    const s = await store();
    const day = s.days.find((d) => d.id === input.day_id) ?? fail('orientation_not_found');
    if (Date.parse(day.ends_at) < Date.now()) fail('orientation_over');
    if (!input.consent) fail('consent_required');
    if (input.name.trim().length < 2) fail('invalid_name');
    if (!GUC_ID_RE.test(input.guc_id.trim())) fail('invalid_guc_id');
    const email = input.email.trim().toLowerCase();
    if (!GUC_EMAIL_RE.test(email)) fail('not_gucian');
    if (input.team_ids.length < 1 || input.team_ids.length > 3 || !input.team_ids.every((t) => demoTeams.some((x) => x.id === t))) fail('invalid_orientation_teams');
    if (s.signups.some((x) => x.cycle_id === day.cycle_id && (x.guc_id === input.guc_id.trim() || x.email === email))) fail('already_signed_up');
    if (day.capacity !== null && s.signups.filter((x) => x.day_id === day.id).length >= day.capacity) fail('orientation_full');
    s.signups.push({ id: `os-${Math.random().toString(36).slice(2, 8)}`, cycle_id: day.cycle_id, day_id: day.id, name: input.name.trim(), guc_id: input.guc_id.trim(), email, team_ids: input.team_ids, attended: false, created_at: new Date().toISOString() });
    save();
  },
  async listSignups(cycleId) {
    const me = demoCurrentMe();
    const mine = (t: string[]) => me?.role === 'chairman' || t.some((id) => (me?.role === 'executive' && me.team_id === id) || (me?.role === 'curator' && demoTeams.find((x) => x.id === id)?.division_id === me.division_id));
    return (await store()).signups.filter((x) => x.cycle_id === cycleId && mine(x.team_ids));
  },
  async setAttended(id, attended) { const s = await store(); Object.assign(s.signups.find((x) => x.id === id)!, { attended }); save(); },
};

export const orientationApi: OrientationApi = DEMO ? demo : live;
