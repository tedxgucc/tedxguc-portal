'use client';
// Orientation before a round: the Chairman sets the days, the board sees
// who signed up for their teams and ticks who came.
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Select, Skeleton, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { orientationApi, type OrientationDay, type OrientationSignup } from '@/lib/api/orientation';
import { recruitmentApi } from '@/lib/api/phase2b';
import { BASE_PATH } from '@/lib/env';
import { fmtDate, fmtTime, fromLocalInput } from '@/lib/format';
import type { Cycle, Team } from '@/lib/types';

export function OrientationTab() {
  const { me } = usePortal();
  const toast = useToast();
  const chair = me.role === 'chairman';
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [days, setDays] = useState<OrientationDay[] | null>(null);
  const [rows, setRows] = useState<OrientationSignup[]>([]);
  const [adding, setAdding] = useState(false);
  const [dayFilter, setDayFilter] = useState('');

  useEffect(() => {
    Promise.all([recruitmentApi.listCycles(), api.listTeams()]).then(([c, t]) => {
      const assoc = c.filter((x) => x.kind === 'associates');
      setCycles(assoc); setTeams(t);
      // Default: the round still being planned, else the newest.
      setCycleId((assoc.filter((x) => Date.parse(x.closes_at) > Date.now()).sort((a, b) => a.opens_at.localeCompare(b.opens_at))[0] ?? assoc[0])?.id ?? '');
    }).catch(() => setCycles([]));
  }, []);
  const load = useCallback(async () => {
    if (!cycleId) return;
    const [d, s] = await Promise.all([orientationApi.listDays(cycleId), orientationApi.listSignups(cycleId)]);
    setDays(d); setRows(s);
  }, [cycleId]);
  useEffect(() => { setDays(null); load().catch(() => setDays([])); }, [load]);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '';
  const shown = useMemo(() => rows.filter((r) => !dayFilter || r.day_id === dayFilter), [rows, dayFilter]);
  const byTeam = useMemo(() => teams.map((t) => ({ t, n: rows.filter((r) => r.team_ids.includes(t.id)).length })).filter((x) => x.n), [rows, teams]);

  if (cycles === null) return <Skeleton h={160} />;
  if (!cycles.length) return <EmptyState title="No associates round yet.">{chair ? 'Create the round in “Rounds” first (its open date can be after orientation), then add the orientation days here.' : 'The Chairman sets up orientation with the next round.'}</EmptyState>;

  const removeDay = async (d: OrientationDay) => {
    if (!confirm(`Remove ${fmtDate(d.starts_at)} and everyone signed up for it?`)) return;
    try { await orientationApi.deleteDay(d.id); toast('ok', 'Day removed.'); load(); } catch (e) { toast('bad', 'That didn’t work.', (e as Error).message); }
  };
  const tick = async (r: OrientationSignup) => {
    setRows((x) => x.map((y) => y.id === r.id ? { ...y, attended: !r.attended } : y));
    try { await orientationApi.setAttended(r.id, !r.attended); } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); load(); }
  };
  const copyLink = () => { navigator.clipboard?.writeText(`${location.origin}${BASE_PATH}/orientation/`); toast('ok', 'Sign-up link copied.'); };
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Name', 'GUC ID', 'Email', 'Day', 'Teams', 'Attended'].join(','), ...shown.map((r) => [r.name, r.guc_id, r.email, fmtDate(days?.find((d) => d.id === r.day_id)?.starts_at ?? r.created_at), r.team_ids.map(teamName).join(' / '), r.attended ? 'yes' : 'no'].map((v) => esc(String(v))).join(','))];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'orientation-signups.csv'; a.click();
  };

  return (
    <div className="grid gap-s5">
      <div className="flex flex-wrap items-end gap-s3">
        <div className="min-w-[240px]"><Select label="Round" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <Button variant="secondary" onClick={copyLink}><Copy size={16} aria-hidden="true" />Copy sign-up link</Button>
      </div>
      <p className="text-caption text-ink-3 -mt-s3">The orientation page is not an event: it doesn’t show with the events. Share the link, or students find it from the Join page while orientation is coming up. Only GUC student emails can sign up.</p>

      <section className="grid gap-s3">
        <h2 className="h4 uppercase">Days</h2>
        {days === null ? <Skeleton h={80} /> : days.length === 0 ? <p className="text-ink-2">No days yet.{chair ? ' Orientation usually runs on two days; add both.' : ''}</p> : (
          <ul className="grid gap-s2 sm:grid-cols-2">
            {days.map((d) => {
              const n = rows.filter((r) => r.day_id === d.id).length;
              return (
                <li key={d.id} className="tx-card grid grid-cols-[minmax(0,1fr)_auto] gap-s3 items-center" style={{ padding: '12px 16px' }}>
                  <span className="grid min-w-0"><span className="font-semibold">{fmtDate(d.starts_at)} · {fmtTime(d.starts_at)}–{fmtTime(d.ends_at)}</span>
                    <span className="text-caption text-ink-3 truncate">{d.location ?? 'No place yet'} · {n}{d.capacity ? ` / ${d.capacity}` : ''} signed up{chair ? '' : ' (your teams)'}</span></span>
                  {chair && <button className="tx-iconbtn" aria-label={`Remove ${fmtDate(d.starts_at)}`} onClick={() => removeDay(d)}><Trash2 size={18} /></button>}
                </li>
              );
            })}
          </ul>
        )}
        {chair && <Button className="justify-self-start" variant="secondary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add a day</Button>}
      </section>

      <section className="grid gap-s3">
        <div className="flex flex-wrap items-end justify-between gap-s3">
          <h2 className="h4 uppercase">Signed up · {rows.length}</h2>
          <div className="flex flex-wrap items-end gap-s2">
            {days && days.length > 1 && <div className="min-w-[180px]"><Select label="Day" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="">Both days</option>{days.map((d) => <option key={d.id} value={d.id}>{fmtDate(d.starts_at)}</option>)}</Select></div>}
            {!!shown.length && <Button variant="secondary" small onClick={exportCsv}>Download CSV</Button>}
          </div>
        </div>
        {!!byTeam.length && <div className="flex flex-wrap gap-s2">{byTeam.map(({ t, n }) => <Chip key={t.id} kind="soft">{t.name} · {n}</Chip>)}</div>}
        {!shown.length ? <p className="text-ink-2">Nobody yet.</p> : (
          <div className="overflow-x-auto">
            <table className="tx-table w-full">
              <thead><tr><th>Name</th><th>GUC ID</th><th>Email</th><th>Day</th><th>Interested in</th><th>Came</th></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.name}</td><td>{r.guc_id}</td><td className="text-body-sm">{r.email}</td>
                  <td>{fmtDate(days?.find((d) => d.id === r.day_id)?.starts_at ?? '')}</td>
                  <td className="text-body-sm">{r.team_ids.map(teamName).join(', ')}</td>
                  <td><input type="checkbox" checked={r.attended} onChange={() => tick(r)} aria-label={`${r.name} came`} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {adding && <DayModal cycleId={cycleId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function DayModal({ cycleId, onClose, onSaved }: { cycleId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('12:00');
  const [to, setTo] = useState('15:00');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!date || !from || !to || to <= from) { toast('bad', 'Pick a date, and an end time after the start.'); return; }
    setBusy(true);
    try {
      await orientationApi.saveDay({ cycle_id: cycleId, starts_at: fromLocalInput(`${date}T${from}`), ends_at: fromLocalInput(`${date}T${to}`), location: location.trim() || null, capacity: capacity ? Math.max(1, parseInt(capacity, 10)) : null });
      toast('ok', 'Day added.'); onSaved();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Add an orientation day" actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add day</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid gap-s4 grid-cols-2">
          <TextInput label="From" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextInput label="To" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <TextInput label="Place" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Building C, Hall C7.01" />
        <TextInput label="Seats (optional)" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} help="Leave empty for no limit." />
      </div>
    </Modal>
  );
}
