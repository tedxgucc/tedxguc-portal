'use client';
import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { HomeArchive } from '@/components/public/HomeArchive';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { DataNotice } from '@/components/public/DataNotice';
import { EventCard } from '@/components/EventCard';
import { SpeakerCard } from '@/components/SpeakerCard';
import { api } from '@/lib/api';
import { usePublicData } from '@/lib/usePublicData';

export default function HomePage() {
  return <><HomeContent /></>;
}
function HomeContent() {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [future, history, allSpeakers] = await Promise.all([api.listEvents('upcoming'), api.listEvents('past'), api.listSpeakers()]);
    const upcoming = future.filter(e => e.type !== 'workshop');
    const past = history.filter(e => e.type !== 'workshop' && e.status === 'completed' && e.slug);
    const next = upcoming[0] ?? null;
    const speakers = next ? allSpeakers.filter(s => s.event_id === next.id) : [];
    return { upcoming, past, next, speakers, allSpeakers };
  });
  const { upcoming, past, speakers, allSpeakers } = data ?? { upcoming: [], past: [], next: null, speakers: [], allSpeakers: [] };
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
      <section className="hm__hero" aria-labelledby="home-title">
        <div className="hm__wm" id="home-watermark" aria-hidden="true" />
        <div className="hm__stack">
          <div className="public-hero-eyebrow reveal"><span className="public-eyebrow-x" aria-hidden="true">x</span><TxLabel>Independently organized. Endlessly curious.</TxLabel></div>
          <h1 id="home-title" className="hm__title reveal-wipe">Ideas worth<span>spreading</span></h1>
          <p className="hm__sub reveal">A space for ideas that challenge, connect and stay with you. Welcome to TEDx at the German University in Cairo.</p>
          <a className="public-scroll-cue reveal" href="#discover">Discover TEDxGUC<ArrowDown size={16} aria-hidden="true" /></a>
        </div>
        <div className="hm__actions reveal">
          <div className="public-next public-next--quiet"><span className="tx-label">Your next experience</span><h2>Stay curious.<br />Stay close.</h2><p>Explore the stories, people and upcoming experiences behind TEDxGUC.</p><Link href="/events" className="tx-btn tx-btn--primary">Explore events<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          {error && <DataNotice message={error} retry={reload} loading={loading} />}
        </div>
      </section>
      <div className="public-hero-foot"><span>Ideas worth spreading</span><span>German University in Cairo</span><span>Since 2013</span></div>
    </div>
    <div id="discover" className="public-container public-home-sections">
      {!!upcoming.length && <section aria-labelledby="upcoming" className="public-section tx-reveal"><div className="public-section-heading"><div><TxLabel>Save the date</TxLabel><SectionHeading><span id="upcoming">Explore our upcoming events.</span></SectionHeading></div><Link href="/events" className="public-text-link">All experiences<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-event-grid">{upcoming.slice(0, 2).map((e) => <EventCard key={e.id} event={e} />)}</div></section>}
      <HomeArchive events={past} speakers={allSpeakers} />
      <section className="public-about-section tx-reveal" aria-labelledby="about-title"><div><TxLabel>Beyond the stage</TxLabel><h2 id="about-title">An idea starts<br />with a <em>connection.</em></h2></div><div className="grid gap-s4 content-center"><p className="body-lg text-ink-2">Since 2013, TEDxGUC has brought people together around ideas worth spreading. Independently organized by students, made for the curious.</p><p className="text-ink-3">Step into a different perspective. Meet someone unexpected. Leave with a question you did not arrive with.</p><Link href="/about" className="public-text-link">Get to know us<ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      {!!speakers.length && <section className="public-section tx-reveal" aria-labelledby="speakers"><div className="public-section-heading"><div><TxLabel>Different voices. Shared curiosity.</TxLabel><SectionHeading><span id="speakers">Meet the minds.</span></SectionHeading></div><Link href="/speakers" className="public-text-link">All speakers<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-speaker-grid">{speakers.slice(0, 4).map((s) => <SpeakerCard key={s.id} speaker={s} preview />)}</div></section>}
      <section className="public-paths" aria-label="Explore TEDxGUC">{[{ n: '01', title: 'The experience', text: 'Discover the next talk or salon.', href: '/events', action: 'Find an event' }, { n: '02', title: 'The people', text: 'Meet the board bringing the season to life.', href: '/board', action: 'Meet the board' }, { n: '03', title: 'Your chapter', text: 'Put your ideas into action with the team.', href: '/join', action: 'Explore open roles' }].map((p) => <Link href={p.href} key={p.n} className="public-path"><span className="public-path__number">{p.n}</span><ArrowUpRight className="public-path__arrow" size={26} aria-hidden="true" /><h3>{p.title}</h3><p>{p.text}</p><span className="public-text-link">{p.action}<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</section>
      <section className="public-faq-section" aria-labelledby="quick-questions"><div><TxLabel>A little clarity</TxLabel><h2 id="quick-questions">Before you<br />come along.</h2><Link href="/contact" className="public-text-link">More questions?<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="public-faq"><details><summary>Are tickets free?<Plus size={20} aria-hidden="true" /></summary><p>Yes. TEDxGUC event tickets are free. Seats are limited, so register through the event page when registration opens.</p></details><details><summary>How do I get my ticket?<Plus size={20} aria-hidden="true" /></summary><p>Register on the event page. Your ticket or waitlist confirmation is sent to the email address you provide. Keep your private ticket link for event day.</p></details><details><summary>Can I join the organizing team?<Plus size={20} aria-hidden="true" /></summary><p>We recruit across eight teams at the start of each season. <Link href="/join" className="tx-link">See open roles and apply.</Link></p></details></div></section>
    </div>
  </>;
}
