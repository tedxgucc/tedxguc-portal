'use client';
// Role dashboards ("Role dashboards" table in the requirements). Each role
// lands on what it needs; Phase 2 adds attendance, budget and evaluations.
import { ArrowRight, CalendarDays, Megaphone, ScanLine, SquareKanban } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SectionHeading, TxLabel } from '@/components/Brand';
import { isLate, KanbanCard } from '@/components/portal/KanbanCard';
import { usePortal } from '@/components/portal/PortalContext';
import { Billboard } from '@/components/portal/Billboard';
import { RoleCards } from '@/components/portal/RoleCards';
import { EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/format';
import { canManageEvents, canManageTeam, canScanTickets, roleLabel } from '@/lib/roles';
import type { Announcement, CalendarItem, EventStats, Task, TxEvent } from '@/lib/types';

export default function Dashboard() {
  const { me, teams, members, eventsToday } = usePortal();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [agenda, setAgenda] = useState<CalendarItem[] | null>(null);
  const [news, setNews] = useState<Announcement[] | null>(null);
  const [next, setNext] = useState<TxEvent | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 86400_000).toISOString();
    api.listTasks().then(setTasks).catch(() => setTasks([]));
    api.calendarFeed(from, to).then((x) => setAgenda(x.filter((i) => i.source !== 'task_deadline'))).catch(() => setAgenda([]));
    api.listAnnouncements().then(setNews).catch(() => setNews([]));
    api.listEvents('upcoming').then(async (evs) => {
      const e = evs[0] ?? null;
      setNext(e);
      if (e && (canManageEvents(me) || canScanTickets(me, true))) setStats(await api.eventStats(e.id).catch(() => null));
    }).catch(() => {});
  }, [me]);

  const mine = (tasks ?? []).filter((t) => t.assignees.includes(me.id) && !['done', 'declined'].includes(t.status));
  const managed = (tasks ?? []).filter((t) => canManageTeam(me, teams.find((x) => x.id === t.team_id)));
  const open = managed.filter((t) => !['done', 'declined'].includes(t.status));
  const review = managed.filter((t) => t.status === 'in_review');
  const requests = managed.filter((t) => t.status === 'requested');
  const overdue = open.filter(isLate);
  const unconfirmed = (news ?? []).filter((a) => a.needs_confirmation && !a.read_by_me);
  const daysTo = next ? Math.max(0, Math.floor((new Date(next.starts_at).getTime() - Date.now()) / 86400_000)) : null;
  const scope = me.role === 'chairman' ? 'Whole club' : me.role === 'curator' ? me.division_name : me.team_name;
  const openTask = (t: Task) => router.push(`/portal/tasks?task=${t.id}`);

  return (
    <div className="grid gap-s6">
      <header className="grid gap-s2">
        <TxLabel>{me.role ? roleLabel[me.role] : 'Alumni'}{scope ? ` · ${scope}` : ''}</TxLabel>
        <h1 className="h1 uppercase">Hi, {me.name.split(' ')[0]}</h1>
      </header>

      <Billboard items={news ?? []} />

      {unconfirmed.length > 0 && (
        <Link href="/portal/news" className="tx-card flex items-center gap-s3 no-underline hover:bg-surface-2" style={{ boxShadow: 'inset 3px 0 0 var(--accent)' }}>
          <Megaphone size={22} className="text-accent shrink-0" aria-hidden="true" />
          <span className="flex-1"><span className="font-semibold">{unconfirmed[0].title}</span><span className="block text-body-sm text-ink-2">Please read and confirm.</span></span>
          <ArrowRight size={20} className="text-ink-3" aria-hidden="true" />
        </Link>
      )}

      <div className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-4 md:gap-s4">
        {next && (
          <Link href={`/event?s=${next.slug}`} className="tx-card tx-card--red tx-kpi no-underline sm:col-span-2 lg:col-span-1">
            <span className="tx-label" style={{ color: '#fff' }}>Next event</span>
            <span className="h3 uppercase">{next.title}</span>
            <span className="caption">{fmtDate(next.starts_at)} · {daysTo === 0 ? 'Today' : `${daysTo} days to go`}</span>
          </Link>
        )}
        {stats && (
          <div className="tx-card tx-kpi">
            <span className="tx-label">Tickets claimed</span>
            <span className="stat tx-num">{stats.registered.toLocaleString('en-US')}</span>
            <span className="caption tx-faint">{stats.capacity ? `of ${stats.capacity.toLocaleString('en-US')} seats` : 'no cap'}{stats.waitlisted ? ` · ${stats.waitlisted} waitlisted` : ''}</span>
          </div>
        )}
        <div className="tx-card tx-kpi">
          <span className="tx-label">My open tasks</span>
          <span className="stat tx-num">{tasks ? mine.length : '–'}</span>
          <span className={`tx-delta ${mine.some(isLate) ? 'down' : ''} caption`}>{mine.filter(isLate).length ? `${mine.filter(isLate).length} late` : 'Nothing late'}</span>
        </div>
        {me.role !== 'associate' && (
          <div className="tx-card tx-kpi">
            <span className="tx-label">{me.role === 'chairman' ? 'Overdue, all teams' : 'Overdue in my teams'}</span>
            <span className="stat tx-num">{tasks ? overdue.length : '–'}</span>
            <span className="caption tx-faint">{review.length} waiting for review{requests.length ? ` · ${requests.length} requests` : ''}</span>
          </div>
        )}
        <RoleCards />
        {me.role === 'chairman' && (
          <div className="tx-card tx-kpi">
            <span className="tx-label">Members this season</span>
            <span className="stat tx-num">{members.length}</span>
            <span className="caption tx-faint">{teams.length} teams</span>
          </div>
        )}
      </div>

      <div className="grid gap-s6 lg:grid-cols-2 lg:items-start">
        <section className="grid gap-s3" aria-labelledby="mytasks">
          <div className="flex items-center justify-between gap-s3">
            <SectionHeading as="h3" className="flex-1"><span id="mytasks">{me.role === 'associate' ? 'My tasks' : 'Needs you'}</span></SectionHeading>
            <Link href="/portal/tasks" className="tx-btn tx-btn--ghost tx-btn--sm"><SquareKanban aria-hidden="true" />Board</Link>
          </div>
          {tasks === null ? <Skeleton h={180} /> : (() => {
            const list = me.role === 'associate' ? mine : [...requests, ...review, ...overdue.filter((t) => !review.includes(t)), ...mine].filter((t, i, a) => a.indexOf(t) === i);
            return list.length
              ? <div className="grid gap-s2">{list.slice(0, 5).map((t) => <KanbanCard key={t.id} task={t} onOpen={openTask} />)}</div>
              : <EmptyState title="No tasks. Suspicious.">When your executive assigns you something, it lands here first.</EmptyState>;
          })()}
        </section>

        <section className="grid gap-s3" aria-labelledby="soon">
          <div className="flex items-center justify-between gap-s3">
            <SectionHeading as="h3" className="flex-1"><span id="soon">Next two weeks</span></SectionHeading>
            <Link href="/portal/calendar" className="tx-btn tx-btn--ghost tx-btn--sm"><CalendarDays aria-hidden="true" />Calendar</Link>
          </div>
          {agenda === null ? <Skeleton h={180} /> : agenda.length ? (
            <ul className="grid gap-s1">
              {agenda.slice(0, 6).map((i) => (
                <li key={`${i.source}-${i.id}`} className="tx-card grid grid-cols-[96px_minmax(0,1fr)] gap-s3 items-center" style={{ padding: '12px 16px' }}>
                  <span className="text-body-sm text-ink-2 tabular-nums">{fmtDate(i.starts_at)}<br />{i.all_day ? 'All day' : fmtTime(i.starts_at)}</span>
                  <span className="grid grid-cols-1 min-w-0">
                    <span className="font-semibold truncate">{i.title}</span>
                    <span className="text-caption text-ink-3 truncate">{i.source === 'event' ? 'Event' : i.visibility === 'team' ? 'Team' : 'Club-wide'}{i.location ? ` · ${i.location}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Quiet two weeks.">Meetings and events show up here.</EmptyState>}

          {stats && canScanTickets(me, !!next && eventsToday.includes(next.id)) && next && (
            <Link href={`/portal/door?event=${next.id}`} className="tx-btn tx-btn--secondary"><ScanLine aria-hidden="true" />Open door check-in</Link>
          )}
        </section>
      </div>

      {news && news.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="news">
          <div className="flex items-center justify-between gap-s3">
            <SectionHeading as="h3" className="flex-1"><span id="news">Announcements</span></SectionHeading>
            <Link href="/portal/news" className="tx-btn tx-btn--ghost tx-btn--sm">All</Link>
          </div>
          <div className="grid gap-s2 md:grid-cols-2">
            {news.slice(0, 2).map((a) => (
              <Link key={a.id} href="/portal/news" className="tx-card grid gap-s1 no-underline hover:bg-surface-2">
                <span className="text-caption text-ink-3">{fmtDate(a.created_at)}{a.pinned ? ' · Pinned' : ''}</span>
                <span className="h4">{a.title}</span>
                <span className="text-body-sm text-ink-2 line-clamp-2">{a.body}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
