// Formatting rules from the design system's voice guide:
// dates "Sat 14 Nov", times "6:00 pm", money "EGP 1,250.00", all in Cairo time.

const TZ = 'Africa/Cairo';

export function fmtDate(iso: string, opts: { year?: boolean } = {}): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', ...(opts.year ? { year: 'numeric' } : {}), timeZone: TZ,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return [get('weekday'), get('day'), get('month'), opts.year ? get('year') : ''].filter(Boolean).join(' ');
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ })
    .format(new Date(iso))
    .replace('AM', 'am')
    .replace('PM', 'pm');
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

export function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
}

export function fmtRelative(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtShortDate(iso);
}

export function egp(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '− ' : ''}EGP ${s}`;
}

// The Cairo calendar day of an instant, as YYYY-MM-DD.
export function cairoDay(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

// Two-digit counts for labels: OPERATIONS (04).
export const count2 = (n: number) => String(n).padStart(2, '0');

// "datetime-local" input value in Cairo time, and back to ISO.
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

export function fromLocalInput(value: string): string {
  // Cairo offset at that moment: compare the same wall time in UTC and Cairo.
  const asUtc = new Date(`${value}:00Z`);
  const cairoWall = new Date(asUtc.toLocaleString('en-US', { timeZone: TZ }));
  const utcWall = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = cairoWall.getTime() - utcWall.getTime();
  return new Date(asUtc.getTime() - offset).toISOString();
}

/** Archive events saved without a real time sit at 00:00 Cairo; show only their date. */
export function hasKnownTime(iso: string): boolean {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(iso)) !== '00:00';
}
