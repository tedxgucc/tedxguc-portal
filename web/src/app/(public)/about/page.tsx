'use client';
import { ArrowDown, ArrowRight, ArrowUpRight, Compass, Megaphone, Mic, Users } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { TxLabel } from '@/components/Brand';
import { DataNotice } from '@/components/public/DataNotice';
import { api } from '@/lib/api';
import { LICENSE_LINE } from '@/lib/env';
import { DIVISION_KEYS } from '@/lib/sections';
import { teamDescription } from '@/lib/team-descriptions';
import { usePublicData } from '@/lib/usePublicData';
import './about.css';

const divisions = [
  { key: 'talks', label: 'Talks', icon: Mic, color: 'var(--div-talks)', line: 'Give an idea its voice.', text: 'The teams behind the research, speaker preparation and conversations that come to the stage.' },
  { key: 'operations', label: 'Operations', icon: Compass, color: 'var(--div-ops)', line: 'Make the experience happen.', text: 'From planning and logistics to partnerships, this division brings the pieces of each experience together.' },
  { key: 'org_development', label: 'Organizational Development', icon: Users, color: 'var(--div-od)', line: 'Build the team behind it.', text: 'Supporting the people inside TEDxGUC through their experience, development and time together.' },
  { key: 'marketing', label: 'Marketing & Coordination', icon: Megaphone, color: 'var(--div-mc)', line: 'Start the conversation.', text: 'The stories, campaigns and visual work that connect TEDxGUC with its audience.' },
];

export default function AboutPage() {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [sections, structure, teams] = await Promise.all([api.getSections(['about', 'tedx', ...DIVISION_KEYS]), api.listDivisions(), api.listTeams()]);
    return { sections, structure, teams };
  });
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % divisions.length;
    else if (e.key === 'ArrowLeft') next = (index + divisions.length - 1) % divisions.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = divisions.length - 1;
    else return;
    e.preventDefault(); setActive(next); tabs.current[next]?.focus();
  };
  return <div className="about-page">
    <section className="about-hero public-container" aria-labelledby="about-title">
      <div className="about-hero__copy">
        <TxLabel>Independently organized. Together by curiosity.</TxLabel>
        <h1 id="about-title">Ideas bring us<br /><span>together.</span></h1>
        <p className="about-hero__intro">{data?.sections.about?.body.text ?? 'TEDxGUC is the TEDx chapter at the German University in Cairo, run by students since 2013.'}</p>
        <a href="#our-story" className="public-scroll-cue">Get to know TEDxGUC<ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <div className="about-hero__art" aria-hidden="true"><div className="about-hero__x" /><div className="about-hero__year"><span>Our story started in</span><b>2013</b><span>And the conversation continues.</span></div></div>
    </section>
    <div className="about-facts"><div className="public-container about-facts__inner"><div><strong>2013</strong><span>Our beginning</span></div><div><strong>04</strong><span>Divisions, working together</span></div><div><strong>08</strong><span>Teams behind the experience</span></div></div></div>
    <div className="public-container about-content">
      {error && <DataNotice message={error} retry={reload} loading={loading} />}
      <nav className="about-jump-links" aria-label="On this page"><span className="tx-label">Explore our story</span><a href="#our-story">Who we are<ArrowDown size={12} aria-hidden="true" /></a><a href="#ted-and-tedx">TED &amp; TEDx<ArrowDown size={12} aria-hidden="true" /></a><a href="#our-divisions">Our divisions<ArrowDown size={12} aria-hidden="true" /></a></nav>
      <section id="our-story" className="about-story" aria-labelledby="story-title">
        <div><TxLabel>01 / The reason we are here</TxLabel><h2 id="story-title">A different perspective.<br /><span>A shared experience.</span></h2></div>
        <div className="about-story__body"><p className="body-lg">An idea can make you pause, ask a better question, or see something familiar in a completely new way.</p><p>TEDxGUC creates room for those moments. We bring people together at the German University in Cairo around talks and conversations worth having.</p><p>Behind each experience is a student team: researching, planning, designing and preparing, so an idea can reach beyond the stage.</p><Link href="/events" className="public-text-link">Explore our experiences<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      </section>
      <section id="ted-and-tedx" className="about-ted" aria-labelledby="ted-title">
        <div className="about-section-heading"><div><TxLabel>02 / A global idea, a local voice</TxLabel><h2 id="ted-title">Same curiosity.<br />Different stages.</h2></div><p>What connects TED, TEDx and TEDxGUC?</p></div>
        <div className="about-ted__cards"><article className="about-ted-card"><span className="tx-label">The global platform</span><h3>TED</h3><p>TED shares ideas through its conferences and TED.com, bringing a wide range of voices to a global audience.</p><span className="about-ted-card__note">Ideas worth spreading</span></article><article className="about-ted-card about-ted-card--local"><span className="tx-label">The independently organized experience</span><h3>TED<span>x</span></h3><p>TEDx events are organized locally under a TED license. TEDxGUC brings that experience to our university community.</p><span className="about-ted-card__note"><span className="about-ted-card__dot" aria-hidden="true" />Local people. Shared possibilities.</span></article></div>
        <div className="about-ted__context"><p>{data?.sections.tedx?.body.text ?? 'TEDx events are independently organized under a TED license. Every TEDxGUC talk follows TED content rules.'}</p><p className="tx-legal">{LICENSE_LINE}</p></div>
      </section>
      <section id="our-divisions" className="about-divisions" aria-labelledby="divisions-title">
        <div className="about-section-heading"><div><TxLabel>03 / How it comes together</TxLabel><h2 id="divisions-title">Four divisions.<br /><span>One experience.</span></h2></div><p>Explore the different parts of the team, and the work that connects them.</p></div>
        <div className="about-division-tabs" role="tablist" aria-label="Explore our divisions">{divisions.map((d, i) => <button key={d.key} ref={(el) => { tabs.current[i] = el; }} id={'division-tab-' + d.key} role="tab" aria-selected={active === i} aria-controls={'division-panel-' + d.key} tabIndex={active === i ? 0 : -1} type="button" onClick={() => setActive(i)} onKeyDown={(e) => onTabKey(e, i)} style={{ '--division-color': d.color } as CSSProperties}><d.icon size={20} aria-hidden="true" /><span>{data?.sections[d.key]?.title ?? d.label}</span><span className="about-division-tabs__number">{String(i + 1).padStart(2, '0')}</span></button>)}</div>
        {divisions.map((division, index) => {
          const section = data?.sections[division.key];
          const divisionId = data?.structure.find((d) => d.kind === division.key)?.id;
          const teams = (data?.teams ?? []).filter((t) => t.division_id === divisionId);
          return <div key={division.key} id={'division-panel-' + division.key} className="about-division-panel" role="tabpanel" hidden={active !== index} aria-labelledby={'division-tab-' + division.key} tabIndex={0} style={{ '--division-color': division.color } as CSSProperties}><div className="about-division-panel__intro"><division.icon size={36} strokeWidth={1.25} aria-hidden="true" /><h3>{division.line}</h3><p>{section?.body.text ?? division.text}</p></div><div className="about-division-panel__teams"><span className="tx-label">Teams in this division</span>{teams.length ? <ul>{teams.map((t, i) => <li key={t.id}><span>{String(i + 1).padStart(2, '0')}</span><div className="about-team-copy"><h4>{t.name}</h4>{teamDescription(t.kind) && <p>{teamDescription(t.kind)}</p>}</div><ArrowRight size={18} aria-hidden="true" /></li>)}</ul> : <p className="text-body-sm text-ink-2">{loading ? 'Loading the teams...' : 'Team details will be shared here.'}</p>}</div></div>;
        })}
      </section>
      <section className="about-invitation" aria-labelledby="invitation-title"><div><TxLabel>Your curiosity belongs here</TxLabel><h2 id="invitation-title">Come for an idea.<br /><span>Be part of what follows.</span></h2><p>Join us at an event, or help bring the next one to life.</p></div><div className="about-invitation__actions"><Link href="/events" className="tx-btn tx-btn--primary">Find your next experience<ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/join" className="public-text-link">Explore the teams<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
    </div>
  </div>;
}
