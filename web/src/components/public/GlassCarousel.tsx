'use client';
// Latest events, shown as Red Dot rows.
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { EventRow } from '@/components/EventCard';
import { SectionHeading, TxLabel } from '@/components/Brand';
import type { TxEvent } from '@/lib/types';

export function GlassCarousel({ events }: { events: TxEvent[] }) {
  return <section className="latest-row" aria-labelledby="latest-title">
    <div className="public-section-heading latest-row__head">
      <div><TxLabel>From the archive</TxLabel><SectionHeading><span id="latest-title">Our latest events</span></SectionHeading></div>
      <Link href="/events" className="rd-more">All events<span><ArrowRight size={16} aria-hidden="true" /></span></Link>
    </div>
    <div className="rd-rows">{events.map((e) => <EventRow key={e.id} event={e} past />)}</div>
  </section>;
}
