// Demo mode for X Access. Same rules as migration 0015.
import { canManageXAccess, canViewXAccess } from '../roles';
import { xaccessSponsors } from '../data/xaccess-sponsors';
import { demoCurrentMe, demoMembers } from './demo-api';
import { friendly } from './errors';
import { ApiError } from './types';
import type { XAccessApi, XCard, XPartner, XRedeem } from './xaccess';

const KEY = 'tx-demo-xaccess-v2';
const DAY = 86400_000;
const day = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const tok = () => Array.from({ length: 2 }, () => Math.random().toString(36).slice(2, 12)).join('');
const fail = (code: string, msg?: string): never => { throw new ApiError(code, msg ?? friendly(code)); };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

type Store = { partners: (XPartner & { pin: string | null })[]; cards: XCard[]; uses: { card_id: string; partner_id: string; at: string }[]; clicks: Record<string, number> };

function fresh(): Store {
  const card = (n: number, name: string, user_id: string | null, status: XCard['status'] = 'active', exp = day(300)): XCard => ({
    id: `xc${n}`, number: `XA-27-${String(n).padStart(4, '0')}`, code: `democard${n}`, holder_name: name, holder_email: null,
    user_id, tier: 'Member', expires_on: exp, status, created_at: new Date(Date.now() - n * DAY).toISOString(),
  });
  return {
    partners: xaccessSponsors.map((p) => ({ ...p, pin: null })),
    cards: [card(1, 'Nour Hassan', 'u-chair'), card(2, 'Hamza El-Sayed', 'u-cur-ops'), card(3, 'Ziad Ibrahim', 'u-as-lnp1'), card(4, 'Salma Tarek', null), card(5, 'Old Guest', null, 'active', day(-3))],
    uses: [],
    clicks: {},
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
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(s())); } catch { /* ignore */ } }
const me = () => demoCurrentMe();
const strip = ({ pin: _p, ...x }: Store['partners'][number]): XPartner => x;
const state = (c: XCard) => (c.status === 'cancelled' ? 'cancelled' : c.expires_on < today() ? 'expired' : 'valid') as 'valid' | 'expired' | 'cancelled';
const manage = () => { if (!canManageXAccess(me())) fail('not_allowed'); };
const nextNumber = () => `XA-27-${String(Math.max(0, ...s().cards.map((c) => Number(c.number.split('-')[2]))) + 1).padStart(4, '0')}`;

export const demoXAccessApi: XAccessApi = {
  async listPerks() { return s().partners.filter((p) => p.is_active && (!p.expires_on || p.expires_on >= today())).sort((a, b) => a.sort_order - b.sort_order).map(strip); },
  async listBanner() {
    return s().partners.filter((p) => p.in_banner && p.is_active && (!p.banner_starts || p.banner_starts <= today()) && (!p.banner_ends || p.banner_ends >= today())).map(strip);
  },
  async bannerClick(id) { s().clicks[id] = (s().clicks[id] ?? 0) + 1; save(); },
  async listPartners() { if (!canViewXAccess(me())) fail('not_allowed'); return s().partners.map(strip); },
  async savePartner(input) {
    manage();
    if (!input.name.trim() || !input.perk.trim()) fail('invalid', 'Add the partner’s name and the perk.');
    if (input.id) Object.assign(s().partners.find((p) => p.id === input.id) ?? fail('not_found'), input);
    else s().partners.push({ ...input, id: `xp${Date.now()}`, pin: null });
    save();
  },
  async setPin(id, pin) {
    manage();
    if (pin !== null && !/^\d{4,8}$/.test(pin)) fail('invalid_pin', 'Use 4 to 8 digits.');
    (s().partners.find((p) => p.id === id) ?? fail('not_found')).pin = pin;
    save();
  },
  async listCards() { if (!canViewXAccess(me())) fail('not_allowed'); return [...s().cards].sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async myCard() { const u = me(); return u ? s().cards.find((c) => c.user_id === u.id && c.status === 'active') ?? s().cards.find((c) => c.user_id === u.id) ?? null : null; },
  async issueCard(input) {
    manage();
    if (!input.name.trim()) fail('invalid_name', 'Add the holder’s name.');
    if (input.user_id && s().cards.some((c) => c.user_id === input.user_id && c.status === 'active')) fail('already_has_card', 'This member already has an active card.');
    const c: XCard = {
      id: `xc${Date.now()}`, number: nextNumber(), code: tok(), holder_name: input.name.trim(), holder_email: input.email?.trim() || null,
      user_id: input.user_id ?? null, tier: input.tier?.trim() || 'Member', expires_on: input.expires_on || day(365), status: 'active', created_at: new Date().toISOString(),
    };
    s().cards.unshift(c);
    save();
    return { number: c.number, code: c.code };
  },
  async issueForMembers(expiresOn) {
    manage();
    let n = 0;
    for (const m of demoMembers()) {
      if (s().cards.some((c) => c.user_id === m.user_id && c.status === 'active')) continue;
      await demoXAccessApi.issueCard({ name: m.name, user_id: m.user_id, expires_on: expiresOn });
      n += 1;
    }
    return n;
  },
  async updateCard(id, patch) { manage(); Object.assign(s().cards.find((c) => c.id === id) ?? fail('not_found'), patch); save(); },
  async usage() {
    if (!canViewXAccess(me())) fail('not_allowed');
    return s().partners.map((p) => {
      const uses = s().uses.filter((u) => u.partner_id === p.id);
      return { partner_id: p.id, uses: uses.length, last_use: uses.sort((a, b) => b.at.localeCompare(a.at))[0]?.at ?? null, clicks: s().clicks[p.id] ?? 0 };
    });
  },
  async getCard(code) {
    const c = s().cards.find((x) => x.code === code);
    return c ? { number: c.number, holder_name: c.holder_name, tier: c.tier, expires_on: c.expires_on, status: state(c) } : null;
  },
  async verify(code) {
    const c = s().cards.find((x) => x.code === code);
    if (!c) return { status: 'not_found' };
    return { status: state(c), first_name: c.holder_name.trim().split(' ')[0], number: c.number, tier: c.tier, expires_on: c.expires_on };
  },
  async redeem(code, partnerId, pin): Promise<XRedeem> {
    const p = s().partners.find((x) => x.id === partnerId && x.is_active);
    if (!p || !p.pin || p.pin !== pin) return { ok: false, error: 'wrong_pin' };
    const c = s().cards.find((x) => x.code === code);
    if (!c) return { ok: false, error: 'card_not_found' };
    if (state(c) !== 'valid') return { ok: false, error: 'card_not_valid' };
    s().uses.unshift({ card_id: c.id, partner_id: p.id, at: new Date().toISOString() });
    save();
    return { ok: true, partner: p.name, first_name: c.holder_name.split(' ')[0] };
  },
};
