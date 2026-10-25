'use client';
// Interview availability, Calendly style (FR-4.4). Executives say when
// they're free (a day, a from–to window, an interview length); the portal
// cuts it into slots and invited applicants book one from their link.
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, Modal, Select, Skeleton, TextInput } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { cairoDay, fmtTime, fromLocalInput } from '@/lib/format';
import { manageableTeams } from '@/lib/roles';
import type { Application, Cycle, InterviewSlot } from '@/lib/types';

const DAY = 86400_000;
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

export function InterviewsTab() {
  const { me, team, teams, memberName } = usePortal();
  const toast = useToast();
  const [slots, setSlots] = useState<InterviewSlot[] | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [weekStart, setWeekStart] = useState(() => cairoDay(new Date()));
  const [open, setOpen] = useState<InterviewSlot | null>(null);
  const load = useCallback(() => {
    recruitmentApi.listSlots().then(setSlots).catch(() => setSlots([]));
    recruitmentApi.listApplications().then(setApps).catch(() => {});
    recruitmentApi.listCycles().then(setCycles).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const mine = manageableTeams(me, teams);
  const active = cycles.filter((c) => c.kind === 'associates' && new Date(c.closes_at).getTime() > Date.now() - 30 * DAY);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = useMemo(() => {
    const m: Record<string, InterviewSlot[]> = {};
    for (const s of slots ?? []) (m[cairoDay(s.starts_at)] ??= []).push(s);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return m;
  }, [slots]);
  const waiting = apps.filter((a) => a.stage === 'interview' && !(slots ?? []).some((s) => s.application_id === a.id));
  const booked = (slots ?? []).filter((s) => s.application_id && new Date(s.ends_at).getTime() > Date.now()).length;
  const free = (slots ?? []).filter((s) => !s.application_id && new Date(s.starts_at).getTime() > Date.now()).length;
  const app = (s: InterviewSlot) => apps.find((a) => a.id === s.application_id);

  const remove = async (s: InterviewSlot) => {
    try { await recruitmentApi.deleteSlot(s.id); setOpen(null); load(); } catch (e) { toast('bad', 'Couldn’t remove.', (e as Error).message); }
  };

  return (
    <div className="grid gap-s6">
      <AddAvailability cycles={active} teamIds={mine.map((t) => t.id)} onSaved={load} />

      <section className="grid gap-s3">
        <div className="flex flex-wrap items-center justify-between gap-s3">
          <div className="flex flex-wrap gap-s2">
            <Chip kind="ok">{booked} booked</Chip>
            <Chip kind="soft">{free} free</Chip>
            {waiting.length > 0 && <Chip kind="pending">{waiting.length} invited, not booked yet</Chip>}
          </div>
          <div className="flex items-center gap-s1">
            <button type="button" className="tx-iconbtn" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft /></button>
            <span className="text-body-sm font-semibold whitespace-nowrap">{dayLabel(days[0])} – {dayLabel(days[6])}</span>
            <button type="button" className="tx-iconbtn" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight /></button>
          </div>
        </div>
        {slots === null ? <Skeleton h={260} /> : (
          <div className="overflow-x-auto -mx-s4 px-s4 md:mx-0 md:px-0">
            <div className="grid grid-cols-7 gap-s2 min-w-[760px]">
              {days.map((d) => (
                <div key={d} className="grid gap-s1 content-start">
                  <div className={`tx-label text-center py-s1 border-b-2 ${d === cairoDay(new Date()) ? 'border-accent' : 'border-line'}`}>{dayLabel(d)}</div>
                  {(byDay[d] ?? []).length === 0 && <span className="caption tx-faint text-center py-s3">—</span>}
                  {(byDay[d] ?? []).map((s) => {
                    const a = app(s);
                    const past = new Date(s.ends_at).getTime() < Date.now();
                    return (
                      <button key={s.id} type="button" onClick={() => setOpen(s)}
                        className={`text-left px-s2 py-s1 text-caption border ${a ? 'bg-accent text-on-accent border-accent' : 'border-line-strong hover:bg-surface-2'} ${past ? 'opacity-50' : ''}`}>
                        <span className="font-semibold tx-num block">{fmtTime(s.starts_at)}</span>
                        <span className="block truncate">{a ? a.applicant_name : 'Free'}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${dayLabel(cairoDay(open.starts_at))} · ${fmtTime(open.starts_at)}–${fmtTime(open.ends_at)}` : ''}
        actions={open && !open.application_id ? <><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button><Button variant="danger" onClick={() => remove(open)}><Trash2 size={16} aria-hidden="true" />Remove this time</Button></> : undefined}>
        {open && (() => {
          const a = app(open);
          return (
            <div className="grid gap-s3 text-body-sm">
              <p className="text-ink-2">{team(open.team_id)?.name}{open.location ? ` · ${open.location}` : ''} · with {open.interviewer_ids.map(memberName).join(', ') || 'someone'}</p>
              {a ? (
                <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-s3 gap-y-s1">
                  <dt className="tx-label pt-[2px]">Name</dt><dd className="font-semibold">{a.applicant_name}</dd>
                  {a.answers.guc_id && <><dt className="tx-label pt-[2px]">GUC ID</dt><dd>{a.answers.guc_id}</dd></>}
                  {a.answers.major && <><dt className="tx-label pt-[2px]">Major</dt><dd>{a.answers.major}</dd></>}
                  <dt className="tx-label pt-[2px]">Email</dt><dd className="break-all">{a.applicant_email}</dd>
                  {a.applicant_phone && <><dt className="tx-label pt-[2px]">Phone</dt><dd>{a.applicant_phone}</dd></>}
                  <dt className="tx-label pt-[2px]">1st choice</dt><dd>{team(a.team_choices[0])?.name}</dd>
                  <dt className="tx-label pt-[2px]">2nd</dt><dd>{a.team_choices[1] ? team(a.team_choices[1])?.name : 'None'}</dd>
                </dl>
              ) : <p>No one has booked this time yet.</p>}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function AddAvailability({ cycles, teamIds, onSaved }: { cycles: Cycle[]; teamIds: string[]; onSaved: () => void }) {
  const { me, team } = usePortal();
  const toast = useToast();
  const [cycleId, setCycleId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(() => cairoDay(new Date(Date.now() + DAY)));
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('17:00');
  const [len, setLen] = useState('20');
  const [gap, setGap] = useState('0');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCycleId((c) => c || cycles[0]?.id || ''); }, [cycles]);
  useEffect(() => { setTeamId((t) => t || teamIds[0] || ''); }, [teamIds]);

  const starts = useMemo(() => {
    if (!date || !from || !to) return [];
    const a = new Date(fromLocalInput(`${date}T${from}`)).getTime();
    const b = new Date(fromLocalInput(`${date}T${to}`)).getTime();
    const step = (Number(len) + Number(gap)) * 60_000;
    const out: number[] = [];
    for (let t = a; t + Number(len) * 60_000 <= b && out.length < 40; t += step) out.push(t);
    return out;
  }, [date, from, to, len, gap]);

  if (!teamIds.length) return null;
  if (!cycles.length) return <p className="text-ink-2">There is no open recruitment round. The Chairman opens one under Rounds.</p>;

  const save = async () => {
    if (!starts.length) { toast('bad', 'That window is too short.', 'Make “to” later than “from”.'); return; }
    if (starts[0] < Date.now()) { toast('bad', 'Pick a time in the future.'); return; }
    setBusy(true);
    try {
      for (const t of starts) {
        await recruitmentApi.addSlot({ cycle_id: cycleId, team_id: teamId, starts_at: new Date(t).toISOString(), ends_at: new Date(t + Number(len) * 60_000).toISOString(), location: place.trim() || undefined, interviewer_ids: [me.id] });
      }
      toast('ok', `${starts.length} times added on ${dayLabel(date)}.`, 'Invited applicants can book them now.');
      onSaved();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="tx-card grid gap-s4" aria-label="Add when you're free">
      <h2 className="tx-heading h3">When are you free?</h2>
      <div className="grid gap-s4 grid-cols-2 md:grid-cols-4">
        <TextInput label="Day" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextInput label="From" type="time" step={300} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextInput label="To" type="time" step={300} value={to} onChange={(e) => setTo(e.target.value)} />
        <Select label="Each interview" value={len} onChange={(e) => setLen(e.target.value)}>
          {['15', '20', '30', '45', '60'].map((m) => <option key={m} value={m}>{m} min</option>)}
        </Select>
        <Select label="Break between" value={gap} onChange={(e) => setGap(e.target.value)}>
          {['0', '5', '10', '15'].map((m) => <option key={m} value={m}>{m === '0' ? 'None' : `${m} min`}</option>)}
        </Select>
        <div className="col-span-2 md:col-span-3"><TextInput label="Room or meeting link" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="C3.201 or a Meet link" /></div>
        {cycles.length > 1 && <Select label="Round" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
        {teamIds.length > 1 && <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>{teamIds.map((t) => <option key={t} value={t}>{team(t)?.name}</option>)}</Select>}
      </div>
      {starts.length > 0 && (
        <div className="flex flex-wrap gap-s1" aria-label="Times that will be added">
          {starts.map((t) => <span key={t} className="tx-chip tx-chip--soft tx-num">{fmtTime(new Date(t).toISOString())}</span>)}
        </div>
      )}
      <div><Button loading={busy} onClick={save} disabled={!starts.length}><Plus size={18} aria-hidden="true" />Add {starts.length || ''} times</Button></div>
    </section>
  );
}
