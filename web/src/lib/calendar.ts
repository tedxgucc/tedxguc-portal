import type { CalendarItem, TxEvent } from './types';

export function publicCalendarEvents(events: TxEvent[], from: string, to: string, now = new Date().toISOString()): CalendarItem[] {
  return events.filter((e) => e.is_public && e.status === 'published' && ['licensed', 'not_required'].includes(e.license_status)
    && Date.parse(e.starts_at) >= Math.max(Date.parse(from), Date.parse(now)) && Date.parse(e.starts_at) < Date.parse(to))
    .map((e) => ({ source: 'event' as const, id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at,
      all_day: false, location: e.venue, online_url: null, team_id: null, visibility: 'public' as const, linked_type: 'event', linked_id: e.id }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
