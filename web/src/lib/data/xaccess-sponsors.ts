import sponsors from './xaccess-sponsors.json';
import type { XPartner } from '../api/xaccess';

// Source: X_ACCESS_Sponsors.xlsx. Numbered artwork is matched by Logo No.
export const xaccessSponsors: XPartner[] = sponsors.map((s) => ({
  id: `58414343-4553-4000-8000-${String(s.number).padStart(12, '0')}`,
  name: s.name,
  logo_url: `/brand/xaccess/${String(s.number).padStart(2, '0')}.png`,
  website: null,
  perk: s.discount ? `${s.discount} off` : s.details,
  terms: s.discount && s.details && !s.details.startsWith('Code:') ? s.details : null,
  promo_code: s.details.startsWith('Code:') ? s.details.slice(5).trim() : null,
  expires_on: null,
  is_active: true,
  sort_order: s.number,
  in_banner: false,
  banner_offer: null,
  banner_starts: null,
  banner_ends: null,
}));
