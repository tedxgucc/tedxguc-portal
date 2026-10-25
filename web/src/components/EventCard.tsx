import { ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { fmtDate, fmtTime } from '@/lib/format';
import type { TxEvent } from '@/lib/types';

export const eventKind = (e: Pick<TxEvent, 'type'>) =>
  e.type === 'main_event' ? 'Main Event' : e.type === 'salon' ? 'Salon' : e.type === 'workshop' ? 'Workshop' : 'Event';

export function EventCard({ event, past = false }: { event: TxEvent; past?: boolean }) {
  const d = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'Africa/Cairo' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Africa/Cairo' }).format(d);
  const href = event.slug ? `/events/${event.slug}` : '/events';
  return (
    <Link href={href} className="tx-card grid grid-cols-[64px_minmax(0,1fr)_auto] gap-s4 items-center no-underline hover:bg-surface-2 transition-colors duration-2">
      <div className="grid text-center" aria-hidden="true">
        <span className="stat" style={{ fontSize: 40, color: past ? 'var(--ink-3)' : 'var(--accent)' }}>{day}</span>
        <span className="tx-label">{month}</span>
      </div>
      <div className="grid grid-cols-1 gap-s1 min-w-0">
        <span className="tx-label">{eventKind(event)}</span>
        <h3 className="h3 uppercase">{event.title}</h3>
        <span className="text-body-sm text-ink-2 flex items-center gap-s1">
          <MapPin size={14} aria-hidden="true" />
          <span className="truncate min-w-0">{fmtDate(event.starts_at)} · {fmtTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ''}</span>
        </span>
      </div>
      <ArrowRight size={22} className="text-ink-3" aria-hidden="true" />
    </Link>
  );
}
