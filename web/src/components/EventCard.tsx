/* eslint-disable @next/next/no-img-element */
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { fmtDate, fmtTime, hasKnownTime } from '@/lib/format';
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
      {event.cover_url ? <img src={event.cover_url} alt="" width={960} height={540} loading="lazy" decoding="async" /> : <EventCover title={event.title} />}
      <div className="public-event-card__date" aria-hidden="true"><b>{day}</b><span>{month}</span><span>{year}</span></div>
      <div className="public-event-card__preview" aria-hidden="true">
        <span className="tx-label">{past ? 'From the archive' : eventKind(event)}</span>
        <strong>{event.title}</strong>
        <span>{fmtDate(event.starts_at, { year: true })}{hasKnownTime(event.starts_at) ? ' / ' + fmtTime(event.starts_at) + ' Cairo' : ''}</span>
        {event.venue && <span>{event.venue}</span>}
        {event.description && <p>{event.description.replace(/\s*Official event listing:\s*https?:\/\/\S+/i, '')}</p>}
        <span className="public-event-card__preview-link">Explore this event <ArrowUpRight size={15} /></span>
      </div>
      <span className="public-event-card__tag">{event.status === 'cancelled' ? 'Cancelled' : past ? 'Past event' : eventKind(event)}</span>
    </div>
    <div className="public-event-card__body"><div className="public-event-card__title"><h3>{event.title}</h3><span className="public-event-card__arrow"><ArrowUpRight size={22} aria-hidden="true" /></span></div>
      <p className="text-caption text-ink-3">{fmtDate(event.starts_at, { year: true })}{hasKnownTime(event.starts_at) ? ` / ${fmtTime(event.starts_at)} Cairo` : ''}</p>
      {event.venue && <p className="public-event-card__venue"><MapPin size={14} aria-hidden="true" />{event.venue}</p>}
      {event.description && <p className="public-event-card__description">{event.description.replace(/\s*Official event listing:\s*https?:\/\/\S+/i, '')}</p>}
      <span className="public-event-card__cta">{past || event.status === 'cancelled' ? 'Explore this event' : 'Discover the experience'}<ArrowUpRight size={15} aria-hidden="true" /></span>
    </div>
  </Link>;
}

// Red Dot event row: year, title, type, date and venue, round arrow. Fills with red from where the pointer enters.
export function EventRow({ event, past = false }: { event: TxEvent; past?: boolean }) {
  const href = event.slug ? '/event?s=' + encodeURIComponent(event.slug) : '/events';
  const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(event.starts_at));
  return <Link href={href} className={'rd-row' + (past ? ' is-past' : '')}
    onPointerEnter={(e) => e.currentTarget.style.setProperty('--mx', `${e.clientX - e.currentTarget.getBoundingClientRect().left}px`)}>
    <span className="rd-row__yr">{year}</span>
    <span className="rd-row__t">{event.title}</span>
    <span className="rd-row__kind">{event.status === 'cancelled' ? 'Cancelled' : eventKind(event)}</span>
    <span className="rd-row__meta">{fmtDate(event.starts_at)}{hasKnownTime(event.starts_at) ? ` · ${fmtTime(event.starts_at)}` : ''}{event.venue ? <><br />{event.venue}</> : null}</span>
    <span className="rd-row__go" aria-hidden="true"><ArrowRight size={18} /></span>
  </Link>;
}

// Cover for events without a photo: a big red dot rising from the corner, the title in the brand font.
export function EventCover({ title, big = false }: { title: string; big?: boolean }) {
  return <div className={'ev-cover' + (big ? ' ev-cover--big' : '')} aria-hidden="true">
    <span className="ev-cover__dot" /><span className="ev-cover__ring" />
    <b className="ev-cover__title">{title}</b>
    <span className="ev-cover__brand">TEDx<i>GUC</i></span>
  </div>;
}
