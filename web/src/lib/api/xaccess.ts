// X Access (FR-18): partners and perks, cards, verify, redemptions and the
// sponsor banner. Supabase when configured, sample data in demo mode.
import { DEMO } from '../env';
import { db } from '../supabase';
import { toApiError } from './errors';
import { ApiError } from './types';
import { demoXAccessApi } from './xaccess-demo';

export type XPartner = {
  id: string; name: string; logo_url: string | null; website: string | null; perk: string; terms: string | null;
  expires_on: string | null; is_active: boolean; sort_order: number;
  in_banner: boolean; banner_offer: string | null; promo_code: string | null; banner_starts: string | null; banner_ends: string | null;
};
export type XPartnerInput = Omit<XPartner, 'id'> & { id?: string };
export type XCard = {
  id: string; number: string; code: string; holder_name: string; holder_email: string | null; user_id: string | null;
  tier: string; expires_on: string; status: 'active' | 'cancelled'; created_at: string;
};
export type XCardState = 'valid' | 'expired' | 'cancelled' | 'not_found';
export type XCardView = { number: string; holder_name: string; tier: string; expires_on: string; status: XCardState };
export type XVerify = { status: XCardState; first_name?: string; number?: string; tier?: string; expires_on?: string };
export type XRedeem = { ok: boolean; error?: 'wrong_pin' | 'too_many_tries' | 'card_not_found' | 'card_not_valid'; partner?: string; first_name?: string };
export type XUsage = { partner_id: string; uses: number; last_use: string | null; clicks: number };

export interface XAccessApi {
  /** Public perks page: active, unexpired partners. */
  listPerks(): Promise<XPartner[]>;
  /** Sponsor banner: partners in the banner today. */
  listBanner(): Promise<XPartner[]>;
  bannerClick(partnerId: string): Promise<void>;
  /** Partnerships: every partner. */
  listPartners(): Promise<XPartner[]>;
  savePartner(input: XPartnerInput): Promise<void>;
  setPin(partnerId: string, pin: string | null): Promise<void>;
  listCards(): Promise<XCard[]>;
  myCard(): Promise<XCard | null>;
  issueCard(input: { name: string; email?: string; user_id?: string | null; expires_on?: string; tier?: string }): Promise<{ number: string; code: string }>;
  issueForMembers(expiresOn?: string): Promise<number>;
  updateCard(id: string, patch: Partial<Pick<XCard, 'holder_name' | 'holder_email' | 'tier' | 'expires_on' | 'status'>>): Promise<void>;
  usage(): Promise<XUsage[]>;
  /** Holder's card page (private link). */
  getCard(code: string): Promise<XCardView | null>;
  /** Partner's verify page. */
  verify(code: string): Promise<XVerify>;
  redeem(code: string, partnerId: string, pin: string): Promise<XRedeem>;
}

async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}
const PARTNER_COLS = 'id, name, logo_url, website, perk, terms, expires_on, is_active, sort_order, in_banner, banner_offer, promo_code, banner_starts, banner_ends';
const CARD_COLS = 'id, number, code, holder_name, holder_email, user_id, tier, expires_on, status, created_at';
export const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
export const inBannerToday = (p: XPartner) => p.in_banner && p.is_active
  && (!p.banner_starts || p.banner_starts <= cairoToday()) && (!p.banner_ends || p.banner_ends >= cairoToday());

const live: XAccessApi = {
  async listPerks() {
    const today = cairoToday();
    const rows = await run<XPartner[]>(db().from('xaccess_partners').select(PARTNER_COLS).eq('is_active', true).order('sort_order').order('name'));
    return rows.filter((p) => !p.expires_on || p.expires_on >= today);
  },
  async listBanner() {
    const rows = await run<XPartner[]>(db().from('xaccess_partners').select(PARTNER_COLS).eq('in_banner', true).eq('is_active', true).order('sort_order'));
    return rows.filter(inBannerToday);
  },
  async bannerClick(partnerId) {
    await db().rpc('xaccess_banner_click', { p_partner_id: partnerId });
  },
  async listPartners() {
    return run(db().from('xaccess_partners').select(PARTNER_COLS).order('sort_order').order('name'));
  },
  async savePartner(input) {
    const { id, ...row } = input;
    if (id) await run(db().from('xaccess_partners').update(row).eq('id', id));
    else await run(db().from('xaccess_partners').insert(row));
  },
  async setPin(partnerId, pin) {
    await run(db().rpc('set_xaccess_pin', { p_partner_id: partnerId, p_pin: pin }));
  },
  async listCards() {
    return run(db().from('xaccess_cards').select(CARD_COLS).order('created_at', { ascending: false }));
  },
  async myCard() {
    const { data } = await db().auth.getUser();
    if (!data.user) return null;
    const rows = await run<XCard[]>(db().from('xaccess_cards').select(CARD_COLS).eq('user_id', data.user.id).order('created_at', { ascending: false }).limit(1));
    return rows[0] ?? null;
  },
  async issueCard(input) {
    return run(db().rpc('issue_xaccess_card', {
      p_name: input.name, p_email: input.email ?? null, p_user_id: input.user_id ?? null, p_expires_on: input.expires_on ?? null, p_tier: input.tier ?? 'Member',
    }));
  },
  async issueForMembers(expiresOn) {
    return run(db().rpc('issue_xaccess_for_members', { p_expires_on: expiresOn ?? null }));
  },
  async updateCard(id, patch) {
    await run(db().from('xaccess_cards').update(patch).eq('id', id));
  },
  async usage() {
    const [uses, clicks] = await Promise.all([
      run<{ partner_id: string; redeemed_at: string }[]>(db().from('xaccess_redemptions').select('partner_id, redeemed_at').order('redeemed_at', { ascending: false }).limit(5000)),
      run<{ partner_id: string; clicks: number }[]>(db().from('xaccess_banner_clicks').select('partner_id, clicks')),
    ]);
    const m = new Map<string, XUsage>();
    const get = (id: string) => m.get(id) ?? (m.set(id, { partner_id: id, uses: 0, last_use: null, clicks: 0 }), m.get(id)!);
    for (const u of uses) { const x = get(u.partner_id); x.uses += 1; x.last_use ??= u.redeemed_at; }
    for (const c of clicks) get(c.partner_id).clicks += c.clicks;
    return [...m.values()];
  },
  async getCard(code) {
    return run(db().rpc('get_xaccess_card', { p_code: code }));
  },
  async verify(code) {
    return run(db().rpc('verify_xaccess', { p_code: code }));
  },
  async redeem(code, partnerId, pin) {
    if (!/^\d{4,8}$/.test(pin)) throw new ApiError('wrong_pin', 'Enter your 4–8 digit PIN.');
    return run(db().rpc('redeem_xaccess', { p_code: code, p_partner_id: partnerId, p_pin: pin }));
  },
};

export const xaccessApi: XAccessApi = DEMO ? demoXAccessApi : live;
