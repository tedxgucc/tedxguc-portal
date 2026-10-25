'use client';
// Announcement billboard: a big scrolling banner of the latest announcements
// with photos, at the top of the portal home. Slides move on their own every
// few seconds (not when reduced motion is on), pause on hover or focus, and
// can be swiped or stepped through.
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtRelative } from '@/lib/format';
import type { Announcement } from '@/lib/types';

const SLIDE_MS = 6000;

export function Billboard({ items }: { items: Announcement[] }) {
  const slides = [...items]
    .sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url) || Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
    .slice(0, 6);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el || !slides.length) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setAt(n);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => go(at + 1), SLIDE_MS);
    return () => clearInterval(t);
  }, [at, paused, go, slides.length]);

  if (!slides.length) return null;
  return (
    <section className="relative mb-s6 overflow-hidden bg-ink" aria-roledescription="carousel" aria-label="Announcements"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div ref={track} className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== at) setAt(i); }}>
        {slides.map((a, i) => (
          <Link key={a.id} href="/portal/news" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${a.title}`}
            className="relative shrink-0 w-full snap-start no-underline h-[260px] md:h-[340px]" tabIndex={i === at ? 0 : -1}>
            {a.image_url
              ? <img src={a.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */
              : <div className="absolute inset-0 bg-accent" aria-hidden="true"><span className="absolute -right-[40px] -bottom-[90px] font-display text-[320px] leading-none text-white/15 select-none">X</span></div>}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.82) 100%)' }} aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-s5 md:p-s6 grid gap-s2 text-white max-w-[820px]">
              <span className="tx-label flex items-center gap-s1" style={{ color: '#fff' }}><Megaphone size={16} aria-hidden="true" />{a.pinned ? 'Pinned' : 'Announcement'} · {fmtRelative(a.created_at)}</span>
              <span className="font-display uppercase leading-[0.95] text-[32px] md:text-[48px]">{a.title}</span>
              <span className="text-body-sm opacity-90 line-clamp-2">{a.body}</span>
            </div>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className="absolute left-s2 top-1/2 -translate-y-1/2 tx-iconbtn bg-black/40 text-white hidden md:grid" aria-label="Previous announcement" onClick={() => go(at - 1)}><ChevronLeft /></button>
          <button type="button" className="absolute right-s2 top-1/2 -translate-y-1/2 tx-iconbtn bg-black/40 text-white hidden md:grid" aria-label="Next announcement" onClick={() => go(at + 1)}><ChevronRight /></button>
          <div className="absolute top-s3 right-s4 flex gap-s1" role="tablist" aria-label="Choose an announcement">
            {slides.map((a, i) => (
              <button key={a.id} type="button" role="tab" aria-selected={i === at} aria-label={`Show ${a.title}`} onClick={() => go(i)}
                className={`h-[4px] border-0 cursor-pointer transition-all ${i === at ? 'w-[28px] bg-white' : 'w-[14px] bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
