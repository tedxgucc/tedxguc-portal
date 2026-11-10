'use client';
/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, MapPin, PlayCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { HomeArchive } from '@/components/public/HomeArchive';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { DataNotice } from '@/components/public/DataNotice';
import { GlassCarousel } from '@/components/public/GlassCarousel';
import { INSTAGRAM_URL } from '@/lib/env';
import { EventCard } from '@/components/EventCard';
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
    <div className="hm public-home-hero">
      <section className={"hm__hero" + (isNext ? "" : " hm__hero--solo")} aria-labelledby="home-title">
        <div className="hm__wm" id="home-watermark" aria-hidden="true" />
        <div className="hm__stack">
          <div className="public-hero-eyebrow reveal"><TxLabel>{isNext ? 'Next main event' : 'TEDxGUC · German University in Cairo'}</TxLabel></div>
          {featured && isNext ? <>
            <h1 id="home-title" className={'hm__title reveal-wipe' + (featured.title.length > 12 ? ' hm__title--long' : '')}>{featured.title}</h1>
            <div className="public-hero-facts reveal">
              <span><CalendarDays size={18} aria-hidden="true" />{fmtDate(featured.starts_at, { year: true })}{hasKnownTime(featured.starts_at) ? ` · ${fmtTime(featured.starts_at)}` : ''}</span>
              {featured.venue && <span><MapPin size={18} aria-hidden="true" />{featured.venue}</span>}
            </div>
            <div className="flex flex-wrap gap-s3 reveal">
              {isNext ? <Link href={'/event?s=' + encodeURIComponent(featured.slug ?? '')} className="tx-btn tx-btn--primary">Register, it’s free<ArrowRight size={18} aria-hidden="true" /></Link>
                : <Link href={'/event?s=' + encodeURIComponent(featured.slug ?? '')} className="tx-btn tx-btn--primary"><PlayCircle size={18} aria-hidden="true" />See the talks</Link>}
              <Link href="/events" className="tx-btn tx-btn--secondary">{isNext ? 'All events' : 'What’s next'}</Link>
            </div>
          </> : <>
            <h1 id="home-title" className="hm__title reveal-wipe">Ideas worth{' '}<span>spreading</span></h1>
            <p className="hm__sub reveal">Stay tuned: our next event is on its way. Until then, swipe through the stages we’ve built so far.</p>
            <div className="flex flex-wrap gap-s3 reveal">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--primary">Get notified on Instagram<ArrowUpRight size={18} aria-hidden="true" /></a>
              <Link href="/events" className="tx-btn tx-btn--secondary">All events</Link>
            </div>
          </>}
          <a className="public-scroll-cue reveal" href="#discover">More about TEDxGUC<ArrowDown size={16} aria-hidden="true" /></a>
        </div>
        <div className="hm__actions reveal">
          {isNext && featured?.cover_url && <Link href={'/event?s=' + encodeURIComponent(featured.slug ?? '')} className="public-hero-photo"><img src={featured.cover_url} alt={`${featured.title}, TEDxGUC`} width={960} height={640} fetchPriority="high" /></Link>}
          {error && <DataNotice message={error} retry={reload} loading={loading} />}
        </div>
      </section>
      {!isNext && past.length > 0 && <GlassCarousel events={past.slice(0, 8)} />}
    </div>
    <div id="discover" className="public-container public-home-sections">
      {!!upcoming.length && <section aria-labelledby="upcoming" className="public-section tx-reveal"><div className="public-section-heading"><div><TxLabel>Save the date</TxLabel><SectionHeading><span id="upcoming">Coming up</span></SectionHeading></div><Link href="/events" className="public-text-link">All experiences<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-event-grid">{upcoming.slice(0, 2).map((e) => <EventCard key={e.id} event={e} />)}</div></section>}
      {isNext && <HomeArchive events={past} speakers={allSpeakers} />}
      <section className="public-about-section tx-reveal" aria-labelledby="about-title"><div><TxLabel>Who we are</TxLabel><h2 id="about-title" className="public-facts">
        <span><b>{years}</b> years</span>{past.length > 0 && <span><b>{past.length}</b> events</span>}{talks.length > 0 && <span><b>{talks.length}</b> talks</span>}</h2></div>
        <div className="grid gap-s4 content-center"><p className="body-lg text-ink-2">We’re a student team at GUC. Every year we pick a theme, find speakers, and put on one main event plus a few salons. Tickets are free.</p>
          {recentTalks.length > 0 && <ul className="public-recent-talks">{recentTalks.map((t) => <li key={t.id}><b>“{t.talk_title}”</b><span>{t.name}</span></li>)}</ul>}
          <Link href="/about" className="public-text-link">More about the team<ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      {!!speakers.length && <section className="public-section tx-reveal" aria-labelledby="speakers"><div className="public-section-heading"><div><TxLabel>{featured?.title ?? 'Speakers'}</TxLabel><SectionHeading><span id="speakers">{isNext ? 'Who’s speaking' : 'Who spoke'}</span></SectionHeading></div><Link href="/speakers" className="public-text-link">All speakers<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-speaker-grid">{speakers.slice(0, 4).map((s) => <SpeakerCard key={s.id} speaker={s} preview />)}</div></section>}
      <section className="public-paths" aria-label="Explore TEDxGUC">{[{ n: '01', title: 'The experience', text: 'Discover the next talk or salon.', href: '/events', action: 'Find an event' }, { n: '02', title: 'The people', text: 'Meet the board bringing the season to life.', href: '/board', action: 'Meet the board' }, { n: '03', title: 'Your chapter', text: 'Put your ideas into action with the team.', href: '/join', action: 'Explore open roles' }].map((p) => <Link href={p.href} key={p.n} className="public-path"><span className="public-path__number">{p.n}</span><ArrowUpRight className="public-path__arrow" size={26} aria-hidden="true" /><h3>{p.title}</h3><p>{p.text}</p><span className="public-text-link">{p.action}<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</section>
      <section className="public-faq-section" aria-labelledby="quick-questions"><div><TxLabel>A little clarity</TxLabel><h2 id="quick-questions">Before you<br />come along.</h2><Link href="/contact" className="public-text-link">More questions?<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-faq"><details><summary>Are tickets free?<Plus size={20} aria-hidden="true" /></summary><p>Yes. TEDxGUC event tickets are free. Seats are limited, so register through the event page when registration opens.</p></details><details><summary>How do I get my ticket?<Plus size={20} aria-hidden="true" /></summary><p>Register on the event page. Your ticket or waitlist confirmation is sent to the email address you provide. Keep your private ticket link for event day.</p></details><details><summary>Can I join the organizing team?<Plus size={20} aria-hidden="true" /></summary><p>We recruit across eight teams at the start of each season. <Link href="/join" className="tx-link">See open roles and apply.</Link></p></details></div></section>
    </div>
  </>;
}
