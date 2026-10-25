// Builds an iCalendar (.ics) feed (FR-15.9). No Deno APIs here, so it
// can be unit-tested with Node.

export type FeedItem = {
  source: string;
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  online_url: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function icsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsDay(iso: string): string {
  // All-day entries use the Cairo calendar date.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
  return parts.replaceAll('-', '');
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 octets must be folded (RFC 5545 §3.1).
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (size + len > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(items: FeedItem[], calendarName: string, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TEDxGUC//Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Africa/Cairo',
  ];
  for (const item of items) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.source}-${item.id}@tedxguc`);
    lines.push(`DTSTAMP:${icsDate(now.toISOString())}`);
    if (item.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDay(item.starts_at)}`);
    } else {
      lines.push(`DTSTART:${icsDate(item.starts_at)}`);
      const end = item.ends_at ?? new Date(new Date(item.starts_at).getTime() + 60 * 60 * 1000).toISOString();
      lines.push(`DTEND:${icsDate(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(item.title)}`);
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (item.online_url) lines.push(`URL:${item.online_url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
