'use client';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { eventKind } from '@/components/EventCard';
import { SpeakerCard } from '@/components/SpeakerCard';
import { EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { PageLoading, useLoad } from '@/lib/useLoad';
import { fmtDate, fmtTime } from '@/lib/format';
import { RegisterPanel } from './RegisterPanel';

// One event, by its web address: /event?s=loose-ends
function EventInner() {
  const slug = useSearchParams().get('s') ?? '';
  const d = useLoad(async () => {
    const event = await api.getEventBySlug(slug);
    if (!event) return { event: null, fields: [], speakers: [] };
    const [fields, speakers] = await Promise.all([api.getEventFields(event.id), api.listSpeakers(event.id)]);
    return { event, fields, speakers };
  }, [slug]);
  useEffect(() => { if (d?.event) document.title = `${d.event.title} · TEDxGUC`; }, [d]);
  if (!d) return <PageLoading />;
  const { event, fields, speakers } = d;
  if (!event) {
    return <div className="mx-auto max-w-[720px] px-s4 pt-s8"><EmptyState title="We can’t find that event." action={<Link href="/events" className="tx-btn tx-btn--secondary">All events</Link>} /></div>;
  }
  const isPast = new Date(event.starts_at) < new Date();
  const open = !isPast && event.status === 'published'
    && (!event.registration_opens_at || new Date(event.registration_opens_at) <= new Date())
    && (!event.registration_closes_at || new Date(event.registration_closes_at) > new Date());
  const notYet = !!event.registration_opens_at && new Date(event.registration_opens_at) > new Date();

  return (
    <>
      <section className="tx-watermark is-hero">
        <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s8 pb-s6 grid gap-s4">
          <TxLabel count={new Date(event.starts_at).getFullYear()}>{eventKind(event)}</TxLabel>
          <h1 className="display uppercase tx-red tx-wipe">{event.title}</h1>
          <ul className="grid gap-s2 text-body text-ink-2 sm:flex sm:flex-wrap sm:gap-s5">
            <li className="flex items-center gap-s2"><CalendarDays size={18} aria-hidden="true" />{fmtDate(event.starts_at, { year: true })}</li>
            <li className="flex items-center gap-s2"><Clock size={18} aria-hidden="true" />{fmtTime(event.starts_at)}{event.ends_at ? ` – ${fmtTime(event.ends_at)}` : ''}</li>
            {event.venue && <li className="flex items-center gap-s2"><MapPin size={18} aria-hidden="true" />{event.venue}</li>}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 grid gap-s7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="grid gap-s7">
          {event.cover_url && <img src={event.cover_url} alt="" className="w-full aspect-[16/9] object-cover" />} {/* eslint-disable-line @next/next/no-img-element */}
          {event.description && <p className="body-lg text-ink-2 max-w-[68ch]">{event.description}</p>}

          {event.agenda.length > 0 && (
            <section className="grid gap-s4" aria-labelledby="agenda">
              <SectionHeading as="h3"><span id="agenda">Agenda</span></SectionHeading>
              <ol className="grid">
                {event.agenda.map((a, i) => (
                  <li key={i} className="grid grid-cols-[88px_minmax(0,1fr)] gap-s4 py-s3 border-b border-line">
                    <span className="text-body-sm font-semibold text-ink-2 tabular-nums">{a.time}</span>
                    <span>
                      <span className="font-semibold">{a.title}</span>
                      {a.speaker && <span className="block text-body-sm text-ink-3">{a.speaker}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {speakers.length > 0 && (
            <section className="grid gap-s4" aria-labelledby="sp">
              <SectionHeading as="h3"><span id="sp">Speakers</span></SectionHeading>
              <div className="grid gap-s4 sm:grid-cols-2">{speakers.map((s) => <SpeakerCard key={s.id} speaker={s} />)}</div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-[88px]" aria-label="Registration">
          <RegisterPanel event={event} fields={fields} open={open} past={isPast} notYet={notYet} />
        </aside>
      </div>
    </>
  );
}

export default function EventPage() {
  return <Suspense><EventInner /></Suspense>;
}
