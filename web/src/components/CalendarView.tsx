'use client';
// Shared calendar (FR-15.1): month, week and list views. Club-wide items are
// solid TEDx red with a small X; team items are outlined in their
// division colour (design system: CalendarPill).
import { ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cairoDay, fmtDate, fmtTime } from '@/lib/format';
import { divClass } from '@/lib/roles';
import type { CalendarItem, Division, Team } from '@/lib/types';
import { Button, EmptyState, Modal, Segmented, Skeleton } from './ui';

type View = 'month' | 'week' | 'list';

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarView({ load, teams = [], divisions = [], canDelete, onDelete, reloadKey = 0, publicMode = false }: {
  load: (from: string, to: string) => Promise<CalendarItem[]>;
  teams?: Team[];
  divisions?: Division[];
  canDelete?: (item: CalendarItem) => boolean;
  onDelete?: (item: CalendarItem) => Promise<void>;
  reloadKey?: number;
  publicMode?: boolean;
}) {
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [open, setOpen] = useState<CalendarItem | null>(null);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setView('list');
  }, []);

  const range = useMemo(() => {
    if (view === 'month') {
      const first = mondayOf(startOfMonth(cursor));
      return { from: first, to: addDays(first, 42) };
    }
    if (view === 'week') {
      const first = mondayOf(cursor);
      return { from: first, to: addDays(first, 7) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from: first, to: addDays(first, 60) };
  }, [view, cursor]);

  const fetchItems = useCallback(async () => {
    setItems(null);
    const list = await load(range.from.toISOString(), range.to.toISOString()).catch(() => []);
    setItems(list);
  }, [load, range]);
  useEffect(() => { fetchItems(); }, [fetchItems, reloadKey]);

  const kindOf = (item: CalendarItem) => {
    if (item.visibility !== 'team' || !item.team_id) return 'club';
    const team = teams.find((t) => t.id === item.team_id);
    const d = divisions.find((x) => x.id === team?.division_id);
    return divClass(d?.kind) ?? 'club';
  };
  const pillClass = (item: CalendarItem) => {
    const k = kindOf(item);
    return k === 'club' ? 'tx-pill tx-pill--club' : `tx-pill tx-pill--team tx-pill--${k}`;
  };
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items ?? []) {
      const k = cairoDay(it.starts_at);
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return map;
  }, [items]);

  const step = (dir: number) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir));
    else setCursor(addDays(cursor, 30 * dir));
  };
  const title = view === 'month'
    ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : `${fmtDate(range.from.toISOString())} – ${fmtDate(addDays(range.to, -1).toISOString())}`;
  const today = ymd(new Date());

  return (
    <div className="grid gap-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <div className="flex items-center gap-s1">
          <button className="tx-iconbtn" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></button>
          <button className="tx-iconbtn" onClick={() => step(1)} aria-label="Next"><ChevronRight /></button>
          <h2 className="h3 uppercase ml-s2" aria-live="polite">{title}</h2>
        </div>
        <div className="flex items-center gap-s2 w-full sm:w-auto">
          <button className="tx-btn tx-btn--ghost tx-btn--sm" onClick={() => setCursor(new Date())}>Today</button>
          <div className="flex-1 sm:w-[260px]">
            <Segmented label="Calendar view" value={view} onChange={setView}
              options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
          </div>
        </div>
      </div>

      {items === null && <Skeleton h={view === 'list' ? 240 : 480} />}

      {items && view === 'month' && (
        <div>
          <div className="grid grid-cols-7 mb-s1" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="tx-label text-center">{d}</div>)}
          </div>
          <div className="tx-month" role="grid" aria-label={title}>
            {Array.from({ length: 42 }, (_, i) => {
              const day = addDays(range.from, i);
              const key = ymd(day);
              const list = byDay.get(key) ?? [];
              const other = day.getMonth() !== cursor.getMonth();
              return (
                <div key={key} role="gridcell" className={`${other ? 'is-other' : ''} ${key === today ? 'is-today' : ''}`}
                  aria-label={`${day.toDateString()}${list.length ? `, ${list.length} items` : ''}`}>
                  <span className="tx-month__d">{day.getDate()}</span>
                  {list.slice(0, 3).map((it) => (
                    <button key={`${it.source}-${it.id}`} className={`${pillClass(it)} text-left w-full`} onClick={() => setOpen(it)}>
                      <span className="truncate">{it.all_day ? '' : `${fmtTime(it.starts_at)} `}{it.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <span className="text-caption text-ink-3 px-s1">+{list.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items && view !== 'month' && (
        (items.length === 0)
          ? <EmptyState title="Nothing planned.">{publicMode ? 'Public events and open days show up here.' : 'Meetings, events and deadlines land here automatically.'}</EmptyState>
          : (
            <ol className="grid gap-s4">
              {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => (
                <li key={day} className="grid gap-s2 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div className={`tx-label pt-s2 ${day === today ? 'text-accent-ink' : ''}`}>{fmtDate(`${day}T12:00:00Z`)}{day === today ? ' · Today' : ''}</div>
                  <ul className="grid gap-s1">
                    {list.map((it) => (
                      <li key={`${it.source}-${it.id}`}>
                        <button onClick={() => setOpen(it)} className="tx-card w-full text-left grid grid-cols-[72px_minmax(0,1fr)] gap-s3 items-center hover:bg-surface-2" style={{ padding: '12px 16px' }}>
                          <span className="text-body-sm font-semibold tabular-nums text-ink-2">{it.all_day ? 'All day' : fmtTime(it.starts_at)}</span>
                          <span className="grid grid-cols-1 gap-s1 min-w-0">
                            <span className={pillClass(it)} style={{ justifySelf: 'start', maxWidth: '100%' }}>{it.title}</span>
                            {it.location && <span className="text-caption text-ink-3 truncate">{it.location}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )
      )}

      <div className="flex flex-wrap gap-s3 text-caption text-ink-3" aria-label="Legend">
        <span className="tx-pill tx-pill--club">Club-wide</span>
        {!publicMode && divisions.map((d) => divClass(d.kind) && (
          <span key={d.id} className={`tx-pill tx-pill--team tx-pill--${divClass(d.kind)}`}>{d.name}</span>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}
        actions={open && canDelete?.(open) && onDelete ? (
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
            <Button variant="danger" onClick={async () => { await onDelete(open); setOpen(null); fetchItems(); }}><Trash2 aria-hidden="true" />Delete</Button>
          </>
        ) : undefined}>
        {open && (
          <div className="grid gap-s3">
            <span className={pillClass(open)} style={{ justifySelf: 'start' }}>
              {open.source === 'event' ? 'Event' : open.source === 'task_deadline' ? 'Task deadline' : open.source === 'meeting' ? 'Meeting' : open.visibility === 'team' ? teams.find((t) => t.id === open.team_id)?.name ?? 'Team' : open.visibility === 'public' ? 'Public' : 'Club-wide'}
            </span>
            <p className="flex items-center gap-s2 text-ink-2"><Clock size={18} aria-hidden="true" />{fmtDate(open.starts_at, { year: true })}{open.all_day ? '' : ` · ${fmtTime(open.starts_at)}${open.ends_at ? ` – ${fmtTime(open.ends_at)}` : ''}`}</p>
            {open.location && <p className="flex items-center gap-s2 text-ink-2"><MapPin size={18} aria-hidden="true" />{open.location}</p>}
            {open.online_url && <a className="tx-link inline-flex items-center gap-s2" href={open.online_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />Join online</a>}
            {open.source === 'task_deadline' && <Link className="tx-link" href={`/portal/tasks?task=${open.id}`}>Open task</Link>}
            {open.source === 'event' && !publicMode && <Link className="tx-link" href={`/portal/events/${open.id}`}>Open event</Link>}
          </div>
        )}
      </Modal>
    </div>
  );
}
