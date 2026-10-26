'use client';
import { Ticket } from 'lucide-react';
import Link from 'next/link';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { Countdown } from '@/components/Countdown';
import { EventCard, eventKind } from '@/components/EventCard';
import { SpeakerCard } from '@/components/SpeakerCard';
import { OpeningScreen } from '@/components/OpeningScreen';
import { api } from '@/lib/api';
import { PageLoading, useLoad } from '@/lib/useLoad';
import { fmtDate, fmtTime } from '@/lib/format';


export default function HomePage() {
  const d = useLoad(async () => {
    const [upcoming, partners] = await Promise.all([api.listEvents('upcoming'), api.listPartners()]);
    const next = upcoming[0] ?? null;
    const speakers = next ? await api.listSpeakers(next.id) : [];
    return { upcoming, partners, next, speakers };
  });
  if (!d) return <PageLoading />;
  const { upcoming, partners, next, speakers } = d;

  return (
    <>
      <OpeningScreen
        title={next?.title ?? 'Ideas worth spreading'}
        label={next ? eventKind(next) : 'TEDxGUC'}
        detail={next ? `${fmtDate(next.starts_at)}${next.venue ? ` · ${next.venue}` : ''}` : undefined}
        description={next ? 'A stage for ideas. A place for new perspectives.' : 'Ideas, conversations and a community at the German University in Cairo.'}
      />
      {/* Hero (FR-1.1): one watermark, the event title in display, countdown, one primary action. */}
      <section className="tx-watermark is-hero">
        <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s8 md:pt-s9 pb-s7 grid gap-s6">
          {next ? (
            <>
              <div className="grid gap-s3">
                <TxLabel count={new Date(next.starts_at).getFullYear()}>{eventKind(next)}</TxLabel>
                <h1 className="display uppercase tx-red tx-wipe">{next.title}</h1>
                <p className="body-lg text-ink-2 max-w-[560px]">
                  {fmtDate(next.starts_at)} · {fmtTime(next.starts_at)}{next.venue ? ` · ${next.venue}` : ''}
                </p>
              </div>
              <div className="max-w-[440px]"><Countdown to={next.starts_at} title={next.title} /></div>
              <div className="flex flex-wrap gap-s3">
                <Link href={`/event?s=${next.slug}`} className="tx-btn tx-btn--primary"><Ticket aria-hidden="true" />Get your ticket</Link>
                <Link href="/events" className="tx-btn tx-btn--secondary">All events</Link>
                <Link href="/login" className="tx-btn tx-btn--ghost">TEDx portal</Link>
              </div>
              <p className="text-caption text-ink-3">Tickets are free. Seats are limited.</p>
            </>
          ) : (
            <div className="grid gap-s3">
              <TxLabel>TEDxGUC</TxLabel>
              <h1 className="display uppercase tx-red tx-wipe">Ideas worth spreading</h1>
              <p className="body-lg text-ink-2 max-w-[560px]">Our next event is on its way. Follow us on Instagram to hear first.</p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 grid gap-s7 md:gap-s9">
        {upcoming.length > 0 && (
          <section className="grid gap-s5" aria-labelledby="upcoming">
            <SectionHeading><span id="upcoming">Coming up</span></SectionHeading>
            <div className="grid gap-s2 md:grid-cols-2 md:gap-s4">
              {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          </section>
        )}

        {speakers.length > 0 && (
          <section className="grid gap-s5" aria-labelledby="speakers">
            <SectionHeading><span id="speakers">On stage</span></SectionHeading>
            <div className="grid gap-s4 sm:grid-cols-2 lg:grid-cols-4">
              {speakers.slice(0, 4).map((s) => <SpeakerCard key={s.id} speaker={s} />)}
            </div>
            <Link href="/speakers" className="tx-btn tx-btn--ghost justify-self-start">All speakers</Link>
          </section>
        )}

        <section className="grid gap-s5 md:grid-cols-2 md:items-start" aria-labelledby="about">
          <div className="grid gap-s4">
            <TxLabel>About</TxLabel>
            <SectionHeading><span id="about">Since 2013</span></SectionHeading>
            <p className="body-lg text-ink-2">TEDxGUC is the TEDx chapter at the German University in Cairo, run by students. Every season a new board brings speakers, ideas and hundreds of guests together.</p>
            <Link href="/about" className="tx-btn tx-btn--secondary justify-self-start">Our story</Link>
          </div>
          <ul className="tx-stars body md:pt-s7">
            <li>Free tickets, always</li>
            <li>Talks shared online after each event</li>
            <li>Run by GUC students, with a new board every season</li>
          </ul>
        </section>

        {partners.length > 0 && (
          <section className="grid gap-s5" aria-labelledby="partners">
            <SectionHeading><span id="partners">Our partners</span></SectionHeading>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-s2">
              {partners.map((p) => (
                <li key={p.id} className="tx-card grid place-items-center text-center min-h-[88px]">
                  <span className="font-bold text-body-sm">{p.company}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="tx-card tx-card--red grid gap-s4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-labelledby="join">
          <div className="grid gap-s2">
            <div className="tx-label" style={{ color: '#fff' }}>Join the team</div>
            <h2 id="join" className="h2 uppercase">Make the next one</h2>
            <p className="text-body" style={{ color: '#fff' }}>We recruit associates at the start of every season across eight teams.</p>
          </div>
          <Link href="/join" className="tx-btn tx-btn--secondary" style={{ color: '#fff', borderColor: '#fff' }}>See open roles</Link>
        </section>
      </div>
    </>
  );
}
