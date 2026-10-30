import type { TxEvent } from './types';
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const timestamp = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
function fold(s: string) {
  const encoder = new TextEncoder(); let line = '', length = 0; const lines: string[] = [];
  for (const c of s) { const size = encoder.encode(c).length; if (length + size > 75) { lines.push(line); line = ' '; length = 1; } line += c; length += size; }
  lines.push(line); return lines.join('\r\n');
}
export function eventCalendar(event: TxEvent, url: string, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TEDxGUC//Public Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', 'UID:' + encodeURIComponent(event.id) + '@tedxguc', 'DTSTAMP:' + timestamp(now.toISOString()), 'DTSTART:' + timestamp(event.starts_at)];
  if (event.ends_at && Date.parse(event.ends_at) > Date.parse(event.starts_at)) lines.push('DTEND:' + timestamp(event.ends_at));
  lines.push('SUMMARY:' + escape(event.title));
  if (event.description) lines.push('DESCRIPTION:' + escape(event.description));
  if (event.venue) lines.push('LOCATION:' + escape(event.venue));
  const link = new URL(url); if (!['https:', 'http:'].includes(link.protocol)) throw new Error('Invalid event URL');
  lines.push('URL:' + escape(link.href), 'END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
