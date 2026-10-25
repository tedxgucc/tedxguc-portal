// Offline door check-in (FR-5.7). The phone keeps, per event:
//   - the ticket list (hashes only, from get_checkin_manifest)
//   - scans made while offline, waiting to sync
// in IndexedDB, so a reload or a dead connection loses nothing.
import { del, get, set } from 'idb-keyval';
import type { ManifestRow } from './types';

export type QueuedScan = { ticket_code: string; scanned_at: string; device_id: string; guest_name: string | null };
type Saved = { rows: ManifestRow[]; savedAt: string; localIn: string[] };

const mKey = (eventId: string) => `tx-manifest-${eventId}`;
const qKey = (eventId: string) => `tx-queue-${eventId}`;

export async function saveManifest(eventId: string, rows: ManifestRow[]) {
  const localIn = rows.filter((r) => r.checked_in_at).map((r) => r.ticket_code_hash);
  await set(mKey(eventId), { rows, savedAt: new Date().toISOString(), localIn } satisfies Saved);
}

export async function loadManifest(eventId: string): Promise<Saved | undefined> {
  return get<Saved>(mKey(eventId));
}

export async function queue(eventId: string): Promise<QueuedScan[]> {
  return (await get<QueuedScan[]>(qKey(eventId))) ?? [];
}

export async function clearQueue(eventId: string) {
  await del(qKey(eventId));
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check a code against the saved list. First scan on this phone wins;
// a repeat is flagged straight away. Conflicts across phones show after sync.
export async function offlineCheckIn(eventId: string, code: string, deviceId: string):
  Promise<{ result: 'ok' | 'already_checked_in' | 'not_found'; row?: ManifestRow }> {
  const saved = await loadManifest(eventId);
  if (!saved) return { result: 'not_found' };
  const hash = await sha256(code.trim());
  const row = saved.rows.find((r) => r.ticket_code_hash === hash);
  if (!row) return { result: 'not_found' };
  if (saved.localIn.includes(hash)) return { result: 'already_checked_in', row };
  saved.localIn.push(hash);
  await set(mKey(eventId), saved);
  const q = await queue(eventId);
  q.push({ ticket_code: code.trim(), scanned_at: new Date().toISOString(), device_id: deviceId, guest_name: row.guest_name });
  await set(qKey(eventId), q);
  return { result: 'ok', row };
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem('tx-device');
    if (!id) {
      id = `door-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('tx-device', id);
    }
    return id;
  } catch {
    return 'door-unknown';
  }
}
