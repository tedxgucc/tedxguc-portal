'use client';
/* eslint-disable @next/next/no-img-element */
// Latest events as a simple sideways-scrolling row.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { eventKind } from '@/components/EventCard';
import { fmtDate } from '@/lib/format';
import type { TxEvent } from '@/lib/types';

export function GlassCarousel({ events }: { events: TxEvent[] }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return <section className="latest-row" aria-labelledby="latest-title">
    <div className="latest-row__head">
      <h2 id="latest-title" className="h3">Our latest events</h2>
      <div className="flex gap-s2">
        <button type="button" className="tx-iconbtn" onClick={() => move(-1)} aria-label="Scroll back"><ChevronLeft aria-hidden="true" /></button>
        <button type="button" className="tx-iconbtn" onClick={() => move(1)} aria-label="Scroll forward"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    <div className="latest-row__track" ref={track}>
      {events.map((e) => <Link key={e.id} href={'/event?s=' + encodeURIComponent(e.slug ?? '')} className="latest-card">
        <div className="latest-card__img">{e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" decoding="async" /> : <span>{e.title}</span>}</div>
        <span className="latest-card__kind">{eventKind(e)} · {fmtDate(e.starts_at, { year: true })}</span>
        <strong>{e.title}</strong>
        {e.venue && <span className="latest-card__venue">{e.venue}</span>}
      </Link>)}
    </div>
  </section>;
}
