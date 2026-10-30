/* eslint-disable @next/next/no-img-element */
import { ArrowUpRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { fmtDate, fmtTime } from '@/lib/format';
import type { TxEvent } from '@/lib/types';

export const eventKind = (e: Pick<TxEvent, 'type'>) => e.type === 'main_event' ? 'Main Event' : e.type === 'salon' ? 'Salon' : e.type === 'workshop' ? 'Workshop' : 'Event';
export function EventCard({ event, past = false }: { event: TxEvent; past?: boolean }) {
  const d = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'Africa/Cairo' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Africa/Cairo' }).format(d);
  const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'Africa/Cairo' }).format(d);
  const href = event.slug ? '/event?s=' + encodeURIComponent(event.slug) : '/events';
  return <Link href={href} className={'public-event-card' + (past ? ' is-past' : '')}>
    <div className="public-event-card__visual">
      {event.cover_url ? <img src={event.cover_url} alt="" width={960} height={540} loading="lazy" decoding="async" /> : <div className="public-event-card__graphic" aria-hidden="true"><span>{eventKind(event)}</span><b>{event.title}</b></div>}
      <div className="public-event-card__date" aria-hidden="true"><b>{day}</b><span>{month}</span><span>{year}</span></div>
      <span className="public-event-card__tag">{event.status === 'cancelled' ? 'Cancelled' : past ? 'Past event' : eventKind(event)}</span>
    </div>
    <div className="public-event-card__body"><div className="public-event-card__title"><h3>{event.title}</h3><span className="public-event-card__arrow"><ArrowUpRight size={22} aria-hidden="true" /></span></div>
      <p className="text-caption text-ink-3">{fmtDate(event.starts_at, { year: true })} / {fmtTime(event.starts_at)} Cairo</p>
      {event.venue && <p className="public-event-card__venue"><MapPin size={14} aria-hidden="true" />{event.venue}</p>}
      {event.description && <p className="public-event-card__description">{event.description}</p>}
      <span className="public-event-card__cta">{past || event.status === 'cancelled' ? 'Explore this event' : 'Discover the experience'}<ArrowUpRight size={15} aria-hidden="true" /></span>
    </div>
  </Link>;
}
