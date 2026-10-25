'use client';
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { eventKind } from '@/components/EventCard';
import { EventForm } from '@/components/portal/EventForm';
import { usePortal } from '@/components/portal/PortalContext';
import { Button, Chip, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import { canManageEvents } from '@/lib/roles';
import type { TxEvent } from '@/lib/types';

const statusChip = (e: TxEvent) => {
  if (e.status === 'draft') return <Chip kind="soft">Draft</Chip>;
  if (e.status === 'cancelled') return <Chip kind="void">Cancelled</Chip>;
  if (e.status === 'completed') return <Chip kind="void">Done</Chip>;
  if (e.license_status === 'pending') return <Chip kind="pending">License pending</Chip>;
  return <Chip kind="ok">Live</Chip>;
};

export default function PortalEvents() {
  const { me } = usePortal();
  const router = useRouter();
  const [events, setEvents] = useState<TxEvent[] | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { api.listAllEvents().then(setEvents).catch(() => setEvents([])); }, []);
  const manage = canManageEvents(me);
  const now = Date.now();
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at).getTime() >= now).reverse();
  const past = (events ?? []).filter((e) => new Date(e.starts_at).getTime() < now);

  const row = (e: TxEvent) => (
    <li key={e.id}>
      <Link href={`/portal/events/${e.id}`} className="tx-card grid grid-cols-[minmax(0,1fr)_auto] gap-s3 items-center no-underline hover:bg-surface-2">
        <span className="grid grid-cols-1 gap-s1 min-w-0">
          <span className="flex flex-wrap items-center gap-s2"><span className="tx-label">{eventKind(e)}</span>{statusChip(e)}{!e.is_public && <Chip kind="soft">Internal</Chip>}</span>
          <span className="h3 uppercase truncate">{e.title}</span>
          <span className="text-body-sm text-ink-2">{fmtDate(e.starts_at, { year: true })} · {fmtTime(e.starts_at)}{e.venue ? ` · ${e.venue}` : ''}</span>
        </span>
        <ArrowRight size={20} className="text-ink-3" aria-hidden="true" />
      </Link>
    </li>
  );

  return (
    <>
      <PageTitle label="Events" count={upcoming.length} title="Events">
        {manage && <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />New event</Button>}
      </PageTitle>
      {events === null && <Skeleton h={240} />}
      {events?.length === 0 && <EmptyState title="No events yet.">{manage ? 'Create the first one; it stays a draft until you publish it.' : 'Events show up here once Operations creates them.'}</EmptyState>}
      {upcoming.length > 0 && <><div className="tx-label mb-s2">Upcoming</div><ul className="grid gap-s2 mb-s6">{upcoming.map(row)}</ul></>}
      {past.length > 0 && <><div className="tx-label mb-s2">Past</div><ul className="grid gap-s2">{past.map(row)}</ul></>}
      {manage && creating && <EventForm open onClose={() => setCreating(false)} onSaved={(e) => router.push(`/portal/events/${e.id}`)} />}
    </>
  );
}
