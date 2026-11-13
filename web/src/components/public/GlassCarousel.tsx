'use client';
// A single row of event cards that scrolls left and right, with arrow buttons.
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EventCard } from '@/components/EventCard';
import { SectionHeading, TxLabel } from '@/components/Brand';
import type { TxEvent } from '@/lib/types';

export function EventRail({ events, past = false, label }: { events: TxEvent[]; past?: boolean; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current; if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update(); el.addEventListener('scroll', update, { passive: true }); addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); removeEventListener('resize', update); };
  }, [events]);
  const move = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 24), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <div className="event-rail">
    <div className="event-rail__nav">
      <button type="button" className="event-rail__btn" onClick={() => move(-1)} disabled={edge.start} aria-label={`Scroll ${label} left`}><ChevronLeft aria-hidden="true" /></button>
      <button type="button" className="event-rail__btn" onClick={() => move(1)} disabled={edge.end} aria-label={`Scroll ${label} right`}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div className="event-rail__track" ref={track} tabIndex={0} role="region" aria-label={label}>
      {events.map((e) => <div className="event-rail__item" key={e.id}><EventCard event={e} past={past} /></div>)}
    </div>
  </div>;
}

export function GlassCarousel({ events }: { events: TxEvent[] }) {
  return <section className="latest-row" aria-labelledby="latest-title">
    <div className="public-section-heading latest-row__head">
      <div><TxLabel>From the archive</TxLabel><SectionHeading><span id="latest-title">Our latest events</span></SectionHeading></div>
      <Link href="/events" className="rd-more">All events<span><ArrowRight size={16} aria-hidden="true" /></span></Link>
    </div>
    <EventRail events={events} past label="Our latest events" />
  </section>;
}
