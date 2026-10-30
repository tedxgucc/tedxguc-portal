import type { Speaker, TxEvent } from './types';
export function filterEvents(events: TxEvent[], query: string, type: string) {
  const term = query.trim().toLocaleLowerCase();
  return events.filter((e) => (!type || e.type === type) && (!term || [e.title, e.description, e.venue].some((s) => s?.toLocaleLowerCase().includes(term))));
}
export function filterSpeakers(speakers: Speaker[], query: string, eventId: string) {
  const term = query.trim().toLocaleLowerCase();
  return speakers.filter((s) => (!eventId || s.event_id === eventId) && (!term || [s.name, s.talk_title, s.bio].some((s) => s?.toLocaleLowerCase().includes(term))));
}
export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}

export function registrationState(event: TxEvent, now = Date.now()) {
  if (event.status !== 'published' || Date.parse(event.starts_at) <= now) return 'closed';
  if (event.registration_opens_at && Date.parse(event.registration_opens_at) > now) return 'soon';
  if (event.registration_closes_at && Date.parse(event.registration_closes_at) <= now) return 'closed';
  return 'open';
}
