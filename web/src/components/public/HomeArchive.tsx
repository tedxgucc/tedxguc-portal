'use client';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { EventCard } from '@/components/EventCard';
import { SpeakerCard } from '@/components/SpeakerCard';
import type { Speaker, TxEvent } from '@/lib/types';

export function HomeArchive({ events, speakers }: { events: TxEvent[]; speakers: Speaker[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const selected = events[index] ?? events[0];
  if (!selected) return null;
  const lineup = speakers.filter(s => s.event_id === selected.id);
  const go = (i: number) => {
    const track = rail.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const target = track.children[i] as HTMLElement | undefined;
    if (target && first) track.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className="public-section tx-reveal home-archive" aria-labelledby="archive-title">
    <div className="public-section-heading"><div><TxLabel>The ideas live on</TxLabel><SectionHeading><span id="archive-title">Revisit the moments.</span></SectionHeading><p className="home-archive-intro">Swipe through our past events. Discover the voices behind each chapter.</p></div><Link href="/events" className="public-text-link">All events<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    <div className="home-archive-toolbar"><span aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(events.length).padStart(2, '0')} <b>{selected.title}</b></span><div><button className="tx-iconbtn" type="button" aria-label="Previous past event" aria-controls="home-archive-rail" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={20} /></button><button className="tx-iconbtn" type="button" aria-label="Next past event" aria-controls="home-archive-rail" disabled={index === events.length - 1} onClick={() => go(index + 1)}><ArrowRight size={20} /></button></div></div>
    <div className="home-archive-rail" ref={rail} id="home-archive-rail" role="region" aria-label="Past events; swipe or use the arrow buttons" tabIndex={0} onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.min(index + 1, events.length - 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(index - 1, 0)); } }} onScroll={() => {
      const track = rail.current; if (!track) return;
      const first = track.firstElementChild as HTMLElement | null; if (!first) return;
      const offsets = Array.from(track.children).map(el => Math.abs((el as HTMLElement).offsetLeft - first.offsetLeft - track.scrollLeft));
      setIndex(offsets.indexOf(Math.min(...offsets)));
    }}>{events.map(e => <div className="home-archive-slide" key={e.id}><EventCard event={e} past /></div>)}</div>
    {!!lineup.length && <div className="home-archive-speakers" key={selected.id}><div className="home-archive-speakers-heading"><h3>Voices from <span>{selected.title}</span></h3><Link href={'/event?s=' + encodeURIComponent(selected.slug ?? '')} className="public-text-link">Full lineup<ArrowUpRight size={16} /></Link></div><div className="public-speaker-grid">{lineup.slice(0, 4).map(s => <SpeakerCard key={s.id} speaker={s} preview />)}</div></div>}
  </section>;
}
