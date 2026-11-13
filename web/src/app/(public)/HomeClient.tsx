'use client';
/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { HomeArchive } from '@/components/public/HomeArchive';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { DataNotice } from '@/components/public/DataNotice';
import { EventRail, GlassCarousel } from '@/components/public/GlassCarousel';
import { INSTAGRAM_URL } from '@/lib/env';
import { SpeakerCard } from '@/components/SpeakerCard';
import { api } from '@/lib/api';
import { usePublicData } from '@/lib/usePublicData';
import { fmtDate, fmtTime, hasKnownTime } from '@/lib/format';
import { homeData, type HomeData } from '@/lib/home-data';

export default function HomeClient({ initial }: { initial?: HomeData }) {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [future, history, allSpeakers] = await Promise.all([api.listEvents('upcoming'), api.listEvents('past'), api.listSpeakers()]);
    return homeData(future, history, allSpeakers);
  }, [], initial);
  const { upcoming, past, speakers, allSpeakers, featured } = data ?? { upcoming: [], past: [], next: null, featured: null, speakers: [], allSpeakers: [] };
  const isNext = !!featured && upcoming.some((e) => e.id === featured.id);
  const talks = allSpeakers.filter((x) => x.talk_title);
  const years = new Date().getFullYear() - 2013;
  const heroWords = featured && isNext ? featured.title.split(' ').filter(Boolean) : ['Ideas', 'Worth', 'Spreading'];
  const heroRef = useRef<HTMLElement>(null), dotRef = useRef<HTMLDivElement>(null), h1Ref = useRef<HTMLHeadingElement>(null);
  // The red dot drifts with the pointer and grows on scroll; the headline turns white where the dot sits behind it.
  useEffect(() => {
    const hero = heroRef.current, dot = dotRef.current, h1 = h1Ref.current; if (!hero || !dot || !h1) return;
    const white = h1.querySelector<HTMLElement>('.rd-h1-white'); if (!white) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let px = 0, py = 0, tx = 0, ty = 0, sc = 1, raf = 0, alive = true;
    const sync = () => { const d = dot.getBoundingClientRect(), h = h1.getBoundingClientRect();
      white.style.setProperty('--cr', d.width / 2 + 'px'); white.style.setProperty('--cx', (d.left + d.width / 2 - h.left) + 'px'); white.style.setProperty('--cy', (d.top + d.height / 2 - h.top) + 'px'); };
    const frame = () => { if (!alive) return; px += (tx - px) * .08; py += (ty - py) * .08;
      dot.style.setProperty('--px', px.toFixed(1) + 'px'); dot.style.setProperty('--py', py.toFixed(1) + 'px'); dot.style.setProperty('--ds', sc.toFixed(3));
      sync(); raf = requestAnimationFrame(frame); };
    const move = (e: PointerEvent) => { tx = (e.clientX / innerWidth - .5) * 46; ty = (e.clientY / innerHeight - .5) * 34; };
    const scroll = () => { const p = Math.min(1, scrollY / innerHeight); sc = 1 + p * .35; ty = p * 120; };
    if (!reduce) { hero.addEventListener('pointermove', move); addEventListener('scroll', scroll, { passive: true }); frame(); }
    else { sync(); addEventListener('resize', sync); }
    return () => { alive = false; cancelAnimationFrame(raf); hero.removeEventListener('pointermove', move); removeEventListener('scroll', scroll); removeEventListener('resize', sync); };
  }, [heroWords.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps
  const numsRef = useRef<HTMLElement>(null), circlesRef = useRef<HTMLDivElement>(null);
  // The black band opens like an iris as it scrolls in; the numbers count up once.
  useEffect(() => {
    const nums = numsRef.current, circles = circlesRef.current; if (!nums || !circles) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { circles.classList.add('is-in'); return; }
    let raf = 0, alive = true;
    const iris = () => { if (!alive) return; const r = nums.getBoundingClientRect(), k = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * .8)));
      nums.style.setProperty('--iris', (6 + k * k * 120) + '%'); raf = requestAnimationFrame(iris); };
    iris();
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; io.disconnect(); circles.classList.add('is-in');
      circles.querySelectorAll<HTMLElement>('[data-n]').forEach((b) => { const n = Number(b.dataset.n), t0 = performance.now();
        const tick = (t: number) => { const k = Math.min(1, (t - t0) / 1400); b.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1 && alive) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    }), { threshold: .15 });
    io.observe(circles);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); };
  }, [data]);
  const recentTalks = past.flatMap((e) => talks.filter((x) => x.event_id === e.id)).slice(0, 3);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (!('IntersectionObserver' in window)) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (!preference.matches) animations.push(entry.target.animate([{ opacity: .6, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)' }));
    }), { threshold: .08 });
    document.querySelectorAll('#discover .tx-reveal, #discover .public-paths, #discover .public-faq-section').forEach(el => observer.observe(el));
    const reduce = () => { if (preference.matches) animations.forEach(a => a.cancel()); };
    preference.addEventListener('change', reduce);
    return () => { observer.disconnect(); animations.forEach(a => a.cancel()); preference.removeEventListener('change', reduce); };
  }, [data]);
  return <>
    <div className="hm public-home-hero rd-home">
      <section className="rd-hero" ref={heroRef} aria-labelledby="home-title">
        <div className="rd-dot" ref={dotRef}>
          <svg viewBox="0 0 500 500" aria-hidden="true"><defs><path id="rd-ring" d="M250 250 m-226 0 a226 226 0 1 1 452 0 a226 226 0 1 1 -452 0" /></defs>
            <text><textPath href="#rd-ring">IDEAS WORTH SPREADING • GERMAN UNIVERSITY IN CAIRO • FREE TALKS AND SALONS • SINCE 2013 • IDEAS WORTH SPREADING • NEW CAIRO • </textPath></text></svg>
          <div className="rd-dot__in">
            <span className="rd-eyebrow">Next event</span>
            {featured && isNext ? <>
              <b>{fmtDate(featured.starts_at, { year: true })}</b>
              <span className="rd-dot__meta">{hasKnownTime(featured.starts_at) ? `${fmtTime(featured.starts_at)} · ` : ''}{featured.venue}</span>
              <Link href={'/event?s=' + encodeURIComponent(featured.slug ?? '')} className="rd-dot__btn">Register, it’s free<ArrowRight size={16} aria-hidden="true" /></Link>
            </> : <><b>On its way.</b><span className="rd-dot__meta">We announce on Instagram first.</span></>}
          </div>
        </div>
        <TxLabel>{isNext ? 'Next main event' : 'TEDxGUC · German University in Cairo'}</TxLabel>
        <h1 id="home-title" ref={h1Ref} className={'rd-h1' + (heroWords.join(' ').length > 22 ? ' rd-h1--long' : '')}>
          {heroWords.map((w, i) => <span className="w" key={i}><i className={!isNext && i === heroWords.length - 1 ? 'spread' : ''}>{w}</i></span>)}
          <span className="rd-h1-white" aria-hidden="true">{heroWords.map((w, i) => <span className="w" key={i}><i className={!isNext && i === heroWords.length - 1 ? 'spread' : ''}>{w}</i></span>)}</span>
        </h1>
        <div className="rd-hero__foot">
          <p>{isNext ? 'Free to attend. Seats are limited, so register early.' : 'Stay tuned: our next event is on its way. Free talks and salons at GUC since 2013.'}</p>
          <div className="rd-hero__cta">
            {featured && isNext ? <Link href={'/event?s=' + encodeURIComponent(featured.slug ?? '')} className="tx-btn tx-btn--primary">Register, it’s free<ArrowRight size={18} aria-hidden="true" /></Link>
              : <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--primary">Get notified on Instagram<ArrowUpRight size={18} aria-hidden="true" /></a>}
            <Link href="/events" className="tx-btn tx-btn--secondary">All events</Link>
          </div>
          <a className="public-scroll-cue" href="#discover">More about TEDxGUC<ArrowDown size={16} aria-hidden="true" /></a>
          {error && <DataNotice message={error} retry={reload} loading={loading} />}
        </div>
      </section>
      {!isNext && past.length > 0 && <GlassCarousel events={past.slice(0, 8)} />}
    </div>
    <div id="discover" className="public-container public-home-sections">
      {!!upcoming.length && <section aria-labelledby="upcoming" className="public-section tx-reveal"><div className="public-section-heading"><div><TxLabel>Save the date</TxLabel><SectionHeading><span id="upcoming">Coming up</span></SectionHeading></div><Link href="/events" className="public-text-link">All experiences<ArrowUpRight size={18} aria-hidden="true" /></Link></div><EventRail events={upcoming} label="Upcoming events" /></section>}
      {isNext && <HomeArchive events={past} speakers={allSpeakers} />}
      <section className="rd-nums" ref={numsRef} aria-labelledby="about-title">
        <div className="rd-nums__grid">
          <div className="rd-circles" ref={circlesRef}>
            <div className="rd-c rd-c1"><b data-n={talks.length || past.length}>{talks.length || past.length}</b><span>{talks.length ? 'talks' : 'events'}</span></div>
            <div className="rd-c rd-c2"><b data-n={past.length}>{past.length}</b><span>events</span></div>
            <div className="rd-c rd-c3"><b data-n={years}>{years}</b><span>years</span></div>
          </div>
          <div>
            <TxLabel>Who we are</TxLabel>
            <h2 id="about-title" className="sr-only">{years} years, {past.length} events, {talks.length} talks</h2>
            <p className="rd-nums__lead">We’re a student team at GUC. Every year we pick a theme, find speakers, and put on one main event plus a few salons. Tickets are free.</p>
            {recentTalks.length > 0 && <ul className="rd-talks">{recentTalks.map((t) => <li key={t.id}><b>“{t.talk_title}”</b><span>{t.name}</span></li>)}</ul>}
            <Link href="/about" className="rd-more rd-more--light">More about the team<span><ArrowRight size={16} aria-hidden="true" /></span></Link>
          </div>
        </div>
      </section>
      {!!speakers.length && <section className="public-section tx-reveal" aria-labelledby="speakers"><div className="public-section-heading"><div><TxLabel>{featured?.title ?? 'Speakers'}</TxLabel><SectionHeading><span id="speakers">{isNext ? 'Who’s speaking' : 'Who spoke'}</span></SectionHeading></div><Link href="/talks" className="public-text-link">All talks<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-speaker-grid">{speakers.slice(0, 4).map((s) => <SpeakerCard key={s.id} speaker={s} preview />)}</div></section>}
      <section className="public-paths" aria-label="Explore TEDxGUC">{[{ n: '01', title: 'The experience', text: 'Discover the next talk or salon.', href: '/events', action: 'Find an event' }, { n: '02', title: 'The people', text: 'Meet the board bringing the season to life.', href: '/board', action: 'Meet the board' }, { n: '03', title: 'Your chapter', text: 'Put your ideas into action with the team.', href: '/join', action: 'Explore open roles' }].map((p) => <Link href={p.href} key={p.n} className="public-path"><span className="public-path__number">{p.n}</span><ArrowUpRight className="public-path__arrow" size={26} aria-hidden="true" /><h3>{p.title}</h3><p>{p.text}</p><span className="public-text-link">{p.action}<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</section>
      <section className="public-faq-section" aria-labelledby="quick-questions"><div><TxLabel>A little clarity</TxLabel><h2 id="quick-questions">Before you<br />come along.</h2><Link href="/contact" className="public-text-link">More questions?<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-faq"><details><summary>Are tickets free?<Plus size={20} aria-hidden="true" /></summary><p>Yes. TEDxGUC event tickets are free. Seats are limited, so register through the event page when registration opens.</p></details><details><summary>How do I get my ticket?<Plus size={20} aria-hidden="true" /></summary><p>Register on the event page. Your ticket or waitlist confirmation is sent to the email address you provide. Keep your private ticket link for event day.</p></details><details><summary>Can I join the organizing team?<Plus size={20} aria-hidden="true" /></summary><p>We recruit across eight teams at the start of each season. <Link href="/join" className="tx-link">See open roles and apply.</Link></p></details></div></section>
    </div>
  </>;
}
