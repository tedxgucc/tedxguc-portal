'use client';
/* eslint-disable @next/next/no-img-element */
// Latest events as a swipeable row of glass cards. The card in the middle grows; the others ease back.
import { ArrowUpRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { eventKind } from '@/components/EventCard';
import { fmtDate } from '@/lib/format';
import type { TxEvent } from '@/lib/types';

export function GlassCarousel({ events }: { events: TxEvent[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current; if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestD = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const card = c as HTMLElement;
        const d = (card.offsetLeft + card.offsetWidth / 2 - mid) / card.offsetWidth;
        card.style.setProperty('--p', String(Math.max(-1.5, Math.min(1.5, d))));
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
      });
      setActive(best);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [events]);

  const go = (i: number) => {
    const el = track.current;
    const card = el?.children[Math.max(0, Math.min(events.length - 1, i))] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return <section className="glass-carousel" aria-label="Our latest events">
    <div className="glass-carousel__head">
      <span className="tx-label">Our latest events</span>
      <div className="glass-carousel__arrows">
        <button type="button" className="glass-btn" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous event"><ChevronLeft aria-hidden="true" /></button>
        <button type="button" className="glass-btn" onClick={() => go(active + 1)} disabled={active === events.length - 1} aria-label="Next event"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    <div className="glass-carousel__track" ref={track}>
      {events.map((e, i) => <Link key={e.id} href={'/event?s=' + encodeURIComponent(e.slug ?? '')} className={'glass-card' + (i === active ? ' is-active' : '')} aria-label={`${e.title}, ${fmtDate(e.starts_at, { year: true })}`}>
        {e.cover_url ? <img src={e.cover_url} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" /> : <div className="glass-card__fallback" aria-hidden="true">{e.title}</div>}
        <div className="glass-card__panel">
          <span className="glass-card__chip">{eventKind(e)}</span>
          <strong>{e.title}</strong>
          <span className="glass-card__meta">{fmtDate(e.starts_at, { year: true })}{e.venue ? <><span aria-hidden="true">·</span><MapPin size={13} aria-hidden="true" />{e.venue}</> : null}</span>
          <span className="glass-card__go" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </div>
      </Link>)}
    </div>
    <div className="glass-carousel__dots" aria-hidden="true">{events.map((e, i) => <button key={e.id} type="button" tabIndex={-1} className={i === active ? 'is-on' : ''} onClick={() => go(i)} />)}</div>
  </section>;
}
