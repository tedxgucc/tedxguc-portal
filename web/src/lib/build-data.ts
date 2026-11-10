// Fetched once at build time so events are in the page HTML for search engines
// and link previews. The page still refreshes them in the browser.
import type { Speaker, TxEvent } from './types';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const COLS = 'id,type,title,slug,description,agenda,starts_at,ends_at,venue,capacity,registration_opens_at,registration_closes_at,license_status,is_public,status,ticket_prefix,cover_url,ticket_partners';

async function get<T>(path: string): Promise<T | null> {
  if (!URL_ || !KEY) return null;
  try {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: 'force-cache' });
    return r.ok ? (await r.json()) as T : null;
  } catch { return null; }
}

export type PublicSnapshot = { upcoming: TxEvent[]; past: TxEvent[]; speakers: Speaker[] };
export async function publicSnapshot(): Promise<PublicSnapshot | undefined> {
  const now = new Date().toISOString();
  const [upcoming, past, speakers] = await Promise.all([
    get<TxEvent[]>(`events?select=${COLS}&status=eq.published&starts_at=gte.${now}&type=neq.workshop&order=starts_at`),
    get<TxEvent[]>(`events?select=${COLS}&status=neq.draft&starts_at=lt.${now}&type=neq.workshop&order=starts_at.desc`),
    get<Speaker[]>('speakers?select=id,event_id,name,bio,photo_url,talk_title,talk_url&is_public=eq.true&order=name'),
  ]);
  if (!upcoming || !past || !speakers) return undefined;
  return { upcoming, past, speakers };
}
