'use client';
// One event: live numbers, edit, registrations list with export (FR-5.6),
// registration questions, door staff and run of show (FR-5).
import { Download, ExternalLink, Pencil, ScanLine, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { eventKind } from '@/components/EventCard';
import { EventForm } from '@/components/portal/EventForm';
import { RegistrationDetails } from '@/components/portal/RegistrationDetails';
import { QuestionsSection, RunOfShowSection, StaffSection } from '@/components/portal/EventSetup';
import { usePortal } from '@/components/portal/PortalContext';
import { Button, Chip, EmptyState, Segmented, Skeleton, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtShortDate, fmtTime } from '@/lib/format';
import { ticketTier } from '@/lib/event-registration';
import { canManageEvents, canScanTickets } from '@/lib/roles';
import type { EventStats, RegistrationRow, TxEvent } from '@/lib/types';

function EventAdminPageInner() {
  const id = useSearchParams().get('id') ?? '';
  const { me } = usePortal();
  const [event, setEvent] = useState<TxEvent | null | undefined>(undefined);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const { doorEvents, eventsToday } = usePortal();
  const manage = canManageEvents(me);
  const door = canScanTickets(me, eventsToday.includes(id)) || doorEvents.includes(id);
  type Tab = 'guests' | 'run' | 'questions' | 'staff';
  const [tab, setTab] = useState<Tab>(manage ? 'guests' : 'run');

  const load = useCallback(async () => {
    const all = await api.listAllEvents().catch(() => []);
    setEvent(all.find((e) => e.id === id) ?? null);
    if (manage || canScanTickets(me, eventsToday.includes(id)) || doorEvents.includes(id)) api.eventStats(id).then(setStats).catch(() => {});
    if (manage) api.listRegistrations(id).then(setRegs).catch(() => setRegs([]));
  }, [id, manage, me, doorEvents, eventsToday]);
  useEffect(() => { load(); }, [load]);

  if (event === undefined) return <Skeleton h={320} />;
  if (event === null) return <EmptyState title="We can’t find that event." action={<Link className="tx-btn tx-btn--secondary" href="/portal/events">All events</Link>} />;

  const shown = (regs ?? []).filter((r) => !q.trim() || `${r.guest_name} ${r.guest_email} ${r.ticket_no ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const exportCsv = () => {
    const head = ['Ticket', 'Name', 'Email', 'Phone', 'Ticket type', 'Guest category', 'GUCian', 'GUC ID', 'National ID', 'Referral source', 'Other referral', 'Status', 'Checked in', 'Registered'];
    const esc = (v: string | null | undefined) => {
      const value = v ?? '';
      return `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    };
    const lines = [head.join(','), ...(regs ?? []).map((r) => [r.ticket_no, r.guest_name, r.guest_email, r.guest_phone, ticketTier(r.guest_type), r.answers?.guest_category, r.answers?.gucian, r.answers?.guc_id, r.answers?.national_id, r.answers?.referral_source, r.answers?.referral_other, r.status, r.checked_in_at, r.created_at].map(esc).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    a.download = `${event.slug ?? event.id}-registrations.csv`;
    a.click();
  };

  const kpi = (label: string, value: number | string, note?: string) => (
    <div className="tx-card tx-kpi"><span className="tx-label">{label}</span><span className="stat tx-num">{value}</span>{note && <span className="caption tx-faint">{note}</span>}</div>
  );

  return (
    <>
      <PageTitle label={eventKind(event)} title={event.title}>
        <div className="flex flex-wrap gap-s2">
          {event.slug && event.is_public && <Link href={`/event?s=${event.slug}`} className="tx-btn tx-btn--ghost tx-btn--sm" target="_blank"><ExternalLink aria-hidden="true" />Public page</Link>}
          {door && <Link href={`/portal/door?event=${event.id}`} className="tx-btn tx-btn--secondary tx-btn--sm"><ScanLine aria-hidden="true" />Door</Link>}
          {manage && <Button small onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Edit</Button>}
        </div>
      </PageTitle>
      <p className="text-ink-2 -mt-s4 mb-s5">{fmtDate(event.starts_at, { year: true })} · {fmtTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ''}</p>

      {stats && (
        <div className="grid gap-s2 grid-cols-2 lg:grid-cols-4 md:gap-s4 mb-s6">
          {kpi('Registered', stats.registered.toLocaleString('en-US'), stats.capacity ? `of ${stats.capacity.toLocaleString('en-US')} seats` : 'no cap')}
          {kpi('Waitlist', stats.waitlisted)}
          {kpi('Checked in', stats.checked_in.toLocaleString('en-US'), stats.registered ? `${Math.round((stats.checked_in / stats.registered) * 100)}% of registered` : undefined)}
          {kpi('Cancelled', stats.cancelled)}
        </div>
      )}

      {manage && (
        <div className="mb-s5 overflow-x-auto -mx-s4 px-s4 md:mx-0 md:px-0"><div className="min-w-[480px] max-w-[640px]">
          <Segmented label="Event area" value={tab} onChange={setTab} options={[{ value: 'guests', label: 'Guests' }, { value: 'run', label: 'Run of show' }, { value: 'questions', label: 'Questions' }, { value: 'staff', label: 'Door staff' }]} />
        </div></div>
      )}
      {tab === 'run' && <RunOfShowSection event={event} />}
      {manage && tab === 'questions' && <QuestionsSection event={event} />}
      {manage && tab === 'staff' && <StaffSection event={event} />}
      {manage && tab === 'guests' && (
        <section className="grid gap-s3" aria-labelledby="regs">
          <div className="flex flex-wrap items-end justify-between gap-s3">
            <h2 id="regs" className="tx-heading h3 flex-1">Guests</h2>
            <Button variant="secondary" small onClick={exportCsv} disabled={!regs?.length}><Download aria-hidden="true" />Export</Button>
          </div>
          <div className="relative sm:w-[360px]">
            <TextInput label="Search guests" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 44 }} />
            <Search size={18} className="absolute left-s4 bottom-[17px] text-ink-3" aria-hidden="true" />
          </div>
          {regs === null ? <Skeleton h={200} /> : shown.length === 0 ? <EmptyState title="No guests yet.">Registrations show up here as they come in.</EmptyState> : (
            <div className="overflow-x-auto"><table className="tx-table">
              <thead><tr><th>Guest</th><th className="hidden md:table-cell">Ticket</th><th className="hidden md:table-cell">Registered</th><th>Status</th></tr></thead>
              <tbody>
                {shown.slice(0, 200).map((r) => (
                  <tr key={r.id}>
                    <td className="tx-strong">
                      {r.guest_name}<span className="tx-chip tx-chip--soft ml-s2" style={{ height: 20 }}>{ticketTier(r.guest_type)}</span>
                      <div className="text-caption text-ink-3 font-normal">{r.guest_email}<span className="md:hidden"> · {r.ticket_no ?? '—'}</span></div>
                      <RegistrationDetails registration={r} />
                    </td>
                    <td className="hidden md:table-cell code">{r.ticket_no ?? '—'}</td>
                    <td className="hidden md:table-cell">{fmtShortDate(r.created_at)}</td>
                    <td>
                      {r.checked_in_at ? <Chip kind="ok">In</Chip> : r.status === 'registered' ? <Chip kind="soft">Ticket</Chip>
                        : r.status === 'waitlisted' ? <Chip kind="pending">Waitlist</Chip> : <Chip kind="void">Cancelled</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          {shown.length > 200 && <p className="text-caption text-ink-3">Showing 200 of {shown.length}. Search or export for the rest.</p>}
        </section>
      )}
      {manage && editing && <EventForm open event={event} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </>
  );
}

export default function EventAdminPage() {
  return <Suspense><EventAdminPageInner /></Suspense>;
}
