'use client';
/* eslint-disable @next/next/no-img-element */
// Events: the next event as a big feature at the top, then everything else below.
// With nothing announced, a short "on its way" strip leads into the archive, so the page is never empty.
import { ArrowRight, ArrowUpRight, CalendarDays, Instagram, MapPin, PlayCircle, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle, SectionHeading, TxLabel } from '@/components/Brand';
import { EventCard, EventCover, eventKind } from '@/components/EventCard';
import { DataNotice } from '@/components/public/DataNotice';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { INSTAGRAM_URL } from '@/lib/env';
import { fmtDate, fmtTime, hasKnownTime } from '@/lib/format';
import { filterEvents } from '@/lib/public-discovery';
import { usePublicData } from '@/lib/usePublicData';
import type { TxEvent } from '@/lib/types';

const kinds = [{ value: '', label: 'All' }, { value: 'main_event', label: 'Main events' }, { value: 'salon', label: 'Salons' }, { value: 'other', label: 'Other events' }];
const eventHref = (e: TxEvent) => (e.slug ? '/event?s=' + encodeURIComponent(e.slug) : '/events');

export default function EventsClient({ initial }: { initial?: { upcoming: TxEvent[]; past: TxEvent[] } }) {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [upcoming, past] = await Promise.all([api.listEvents('upcoming'), api.listEvents('past')]);
    return { upcoming: upcoming.filter((e) => e.type !== 'workshop'), past: past.filter((e) => e.type !== 'workshop') };
  }, [], initial);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const upcoming = data?.upcoming ?? [];
  const featured = upcoming.find((e) => e.type === 'main_event') ?? upcoming[0] ?? null;
  const moreUpcoming = filterEvents(upcoming.filter((e) => e.id !== featured?.id), query, kind);
  const past = filterEvents([...(data?.past ?? [])].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)), query, kind);
  const filtering = !!(query.trim() || kind);
  const reset = () => { setQuery(''); setKind(''); };

  return <div className="public-container public-discovery">
    <div className="public-page-intro"><PageTitle label="Events" title="Find your next idea." /><p>Talks and salons at the German University in Cairo. Free to attend, open to everyone curious.</p></div>
    {error && <DataNotice message={error} retry={reload} loading={loading} />}
    {!data && loading ? <div className="grid gap-s5" aria-busy="true" aria-label="Loading events"><Skeleton h={420} /><div className="public-event-grid"><Skeleton h={360} /><Skeleton h={360} /><Skeleton h={360} /></div></div> : data && <>
      {featured ? <Featured event={featured} /> : <OnItsWay />}

      {moreUpcoming.length > 0 && <section className="ev-section" aria-labelledby="ev-more">
        <div><TxLabel>Also coming up</TxLabel><SectionHeading><span id="ev-more">More dates</span></SectionHeading></div>
        <div className="public-event-grid">{moreUpcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
      </section>}

      <section className="ev-section" aria-labelledby="ev-past">
        <div className="ev-past-head">
          <div><TxLabel>From the archive</TxLabel><SectionHeading><span id="ev-past">Past events</span></SectionHeading></div>
          <label className="public-search"><span className="sr-only">Search events by name, description or venue</span><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events or venues" /></label>
        </div>
        <div className="ev-filter-bar">
          <div className="public-filter-row" role="group" aria-label="Event type">{kinds.map((k) => <button type="button" key={k.value} aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</button>)}</div>
          <p className="ev-count" role="status" aria-live="polite">{past.length} {past.length === 1 ? 'event' : 'events'}{filtering && <button type="button" onClick={reset}><X size={14} aria-hidden="true" />Clear</button>}</p>
        </div>
        {past.length ? <div className="public-event-grid">{past.map((e) => <EventCard key={e.id} event={e} past />)}</div>
          : <EmptyState title={filtering ? 'No matches.' : 'Our archive is on its way.'} action={filtering ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : undefined}>{filtering ? 'Try another name, venue or event type.' : 'Past events will appear here.'}</EmptyState>}
      </section>
    </>}
  </div>;
}

// The next event, big: photo on one side, the essentials and Register on the other.
function Featured({ event: e }: { event: TxEvent }) {
  return <section className="ev-feature" aria-labelledby="ev-feature-title">
    <Link href={eventHref(e)} className="ev-feature__media" tabIndex={-1} aria-hidden="true">
      {e.cover_url ? <img src={e.cover_url} alt="" /> : <EventCover title={e.title} big />}
      <span className="ev-feature__badge"><b>{new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(e.starts_at))}</b>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Africa/Cairo' }).format(new Date(e.starts_at))}</span>
    </Link>
    <div className="ev-feature__body">
      <TxLabel>Next {eventKind(e).toLowerCase()}</TxLabel>
      <h2 id="ev-feature-title">{e.title}</h2>
      <ul className="ev-feature__facts">
        <li><CalendarDays size={18} aria-hidden="true" />{fmtDate(e.starts_at, { year: true })}{hasKnownTime(e.starts_at) ? ` · ${fmtTime(e.starts_at)}` : ''}</li>
        {e.venue && <li><MapPin size={18} aria-hidden="true" />{e.venue}</li>}
      </ul>
      {e.description && <p>{e.description.replace(/\s*Official event listing:\s*https?:\/\/\S+/i, '')}</p>}
      <div className="ev-feature__cta">
        <Link href={eventHref(e)} className="tx-btn tx-btn--primary">Register, it’s free<ArrowRight size={18} aria-hidden="true" /></Link>
        <Link href={eventHref(e)} className="tx-btn tx-btn--secondary">Event details</Link>
      </div>
    </div>
  </section>;
}

// Nothing announced yet: a short strip, then the archive right below.
function OnItsWay() {
  return <section className="ev-soon" aria-labelledby="ev-soon-title">
    <span className="ev-soon__dot" aria-hidden="true" />
    <div className="ev-soon__text">
      <TxLabel>Next event</TxLabel>
      <h2 id="ev-soon-title">On its way.</h2>
      <p>We announce on Instagram first. Until then, look back at what we’ve put on stage.</p>
    </div>
    <div className="ev-soon__cta">
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--primary"><Instagram size={18} aria-hidden="true" />Get notified<ArrowUpRight size={16} aria-hidden="true" /></a>
      <Link href="/talks" className="tx-btn tx-btn--secondary"><PlayCircle size={18} aria-hidden="true" />Watch the talks</Link>
    </div>
  </section>;
}
