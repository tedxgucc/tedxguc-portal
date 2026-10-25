import type { Metadata } from 'next';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { SpeakerCard } from '@/components/SpeakerCard';
import { EmptyState } from '@/components/ui';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Speakers' };
export const revalidate = 60;

export default async function SpeakersPage() {
  const [speakers, events] = await Promise.all([api.listSpeakers(), api.listEvents('all')]);
  const byEvent = events
    .map((e) => ({ event: e, speakers: speakers.filter((s) => s.event_id === e.id) }))
    .filter((g) => g.speakers.length > 0);
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Speakers" count={speakers.length} title="Speakers" />
      {byEvent.length === 0 && <EmptyState title="Speakers coming soon.">We announce speakers one by one before each event. Follow us on Instagram.</EmptyState>}
      {byEvent.map(({ event, speakers: list }) => (
        <section key={event.id} className="grid gap-s4" aria-labelledby={`e-${event.id}`}>
          <SectionHeading as="h3"><span id={`e-${event.id}`}>{event.title}</span></SectionHeading>
          <div className="grid gap-s4 sm:grid-cols-2 lg:grid-cols-4">{list.map((s) => <SpeakerCard key={s.id} speaker={s} />)}</div>
        </section>
      ))}
    </div>
  );
}
