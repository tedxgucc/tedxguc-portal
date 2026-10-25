'use client';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { EventCard } from '@/components/EventCard';
import { EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { PageLoading, useLoad } from '@/lib/useLoad';


export default function EventsPage() {
  const d = useLoad(async () => {
    const [upcoming, past] = await Promise.all([api.listEvents('upcoming'), api.listEvents('past')]);
    return { upcoming, past };
  });
  if (!d) return <PageLoading />;
  const { upcoming, past } = d;
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Events" count={upcoming.length} title="Events" />
      <section className="grid gap-s4" aria-labelledby="up">
        <SectionHeading as="h3"><span id="up">Upcoming</span></SectionHeading>
        {upcoming.length
          ? <div className="grid gap-s2 md:grid-cols-2 md:gap-s4">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
          : <EmptyState title="Nothing on the calendar yet.">Our next event is being planned. Follow us on Instagram to hear first.</EmptyState>}
      </section>
      {past.length > 0 && (
        <section className="grid gap-s4" aria-labelledby="past">
          <SectionHeading as="h3"><span id="past">Past events</span></SectionHeading>
          <div className="grid gap-s2 md:grid-cols-2 md:gap-s4">{past.map((e) => <EventCard key={e.id} event={e} past />)}</div>
        </section>
      )}
    </div>
  );
}
