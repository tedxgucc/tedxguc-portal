'use client';
import { Copy, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Modal, Select, Skeleton, TextInput } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { cairoDay, fmtDate, fmtTime, fromLocalInput } from '@/lib/format';
import { availabilitySlots, defaultAvailability, WEEKDAYS, type InterviewAvailability, type TimeRange } from '@/lib/interview-availability';
import type { Cycle } from '@/lib/types';

function Hours({ label, ranges, onChange, disabled }: { label: string; ranges: TimeRange[]; onChange: (ranges: TimeRange[]) => void; disabled: boolean }) {
  const invalid = ranges.findIndex((r) => !r.from || !r.to || r.to <= r.from);
  return <div className="grid gap-s2 min-w-0">
    {ranges.length === 0 && <span className="text-body-sm text-ink-3 py-s2">Unavailable</span>}
    {ranges.map((range, i) => <div key={i} className="flex flex-wrap items-end gap-s2">
      <div className="flex-1 min-w-[100px]"><TextInput label={`${label} start ${i + 1}`} type="time" value={range.from} disabled={disabled} onChange={(e) => onChange(ranges.map((r, j) => i === j ? { ...r, from: e.target.value } : r))} /></div>
      <div className="flex-1 min-w-[100px]"><TextInput label={`${label} end ${i + 1}`} type="time" value={range.to} disabled={disabled} onChange={(e) => onChange(ranges.map((r, j) => i === j ? { ...r, to: e.target.value } : r))} /></div>
      <button type="button" className="tx-iconbtn shrink-0 mb-s1" disabled={disabled} title="Remove time range" aria-label={`Remove ${label} range ${i + 1}`} onClick={() => onChange(ranges.filter((_, j) => j !== i))}><X size={16} /></button>
    </div>)}
    <div><Button small variant="ghost" disabled={disabled || ranges.at(-1)?.to === '23:59'} onClick={() => {
      const from = ranges.at(-1)?.to ?? '09:00';
      const end = Math.min(1439, Number(from.slice(0, 2)) * 60 + Number(from.slice(3)) + (ranges.length ? 60 : 480));
      const to = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
      onChange([...ranges, { from, to }]);
    }}><Plus size={16} aria-hidden="true" />Add hours</Button></div>
    {invalid >= 0 && <p className="tx-help" role="alert">Range {invalid + 1}: enter an end time after the start.</p>}
  </div>;
}

export function AvailabilitySettings({ cycles, teamIds, onSaved }: { cycles: Cycle[]; teamIds: string[]; onSaved: () => void }) {
  const { me, team } = usePortal();
  const toast = useToast();
  const [cycleId, setCycleId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [draft, setDraft] = useState<InterviewAvailability>(() => defaultAvailability(cairoDay(new Date())));
  const [date, setDate] = useState(() => cairoDay(new Date()));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyDay, setCopyDay] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setCycleId((c) => cycles.some((x) => x.id === c) ? c : cycles[0]?.id ?? ''); }, [cycles]);
  useEffect(() => { setTeamId((t) => teamIds.includes(t) ? t : teamIds[0] ?? ''); }, [teamIds]);
  useEffect(() => {
    if (!cycleId || !teamId) return;
    let alive = true;
    setLoading(true); setLoadError(null); setError(null);
    recruitmentApi.getAvailability(cycleId, teamId).then((saved) => {
      if (alive) setDraft(saved ?? defaultAvailability(cairoDay(new Date())));
    }).catch((e) => { if (alive) setLoadError((e as Error).message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cycleId, teamId, me.id, retry]);
  const preview = useMemo(() => {
    try { return { slots: availabilitySlots(draft, fromLocalInput), error: null }; }
    catch (e) { return { slots: [], error: (e as Error).message }; }
  }, [draft]);
  const previewDays = useMemo(() => {
    const days = new Map<string, typeof preview.slots>();
    for (const slot of preview.slots) { const day = cairoDay(slot.starts_at); days.set(day, [...(days.get(day) ?? []), slot]); }
    return [...days.entries()];
  }, [preview.slots]);
  const patch = (values: Partial<InterviewAvailability>) => { setDraft((d) => ({ ...d, ...values })); setError(null); };
  const save = async (publish: boolean) => {
    if (preview.error) { setError(preview.error); return; }
    setBusy(true); setError(null);
    try {
      const result = await recruitmentApi.saveAvailability(cycleId, teamId, draft, publish ? preview.slots : []);
      toast('ok', publish ? `${result.added} interview slots published.` : 'Availability saved.', publish ? `${result.skipped} existing slots kept. Invited applicants can book the new times.` : 'Your weekly hours and date-specific changes are saved.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (!teamIds.length) return null;
  if (!cycles.length) return <p className="text-ink-2">There is no recruitment round available. The Chairman opens one under Rounds.</p>;
  return <section className="tx-card grid gap-s5" aria-label="Interview scheduling settings">
    <div><h2 className="h3">Scheduling settings</h2><p className="text-body-sm text-ink-2 mt-s2">Set your availability, then publish bookable interviews for a date range. All times are in Cairo.</p></div>
    <div className="grid gap-s3 sm:grid-cols-2">
      <Select label="Recruitment round" disabled={busy} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Select label="Team" disabled={busy} value={teamId} onChange={(e) => setTeamId(e.target.value)}>{teamIds.map((id) => <option key={id} value={id}>{team(id)?.name}</option>)}</Select>
    </div>
    {loading ? <Skeleton h={320} /> : loadError ? <div role="alert" className="grid gap-s3"><p className="text-body-sm">Scheduling settings could not load. Existing interview bookings are still listed below.</p><p className="tx-help">{loadError}</p><div><Button small variant="secondary" onClick={() => setRetry((n) => n + 1)}>Retry</Button></div></div> : <>
      <div className="grid gap-s6 xl:grid-cols-2">
        <div className="grid gap-s3 content-start">
          <div><h3 className="h4">Weekly hours</h3><p className="text-body-sm text-ink-3">Add one or more ranges for each day you are available. Overlapping hours are combined into one window.</p></div>
          {WEEKDAYS.map((day, i) => <div key={day} className="grid gap-s2 border-b border-line pb-s3 sm:grid-cols-[100px_minmax(0,1fr)]">
            <div className="flex sm:flex-col gap-s2 items-center sm:items-start"><span className="font-semibold text-body-sm pt-s2">{day}</span><button type="button" className="tx-iconbtn" disabled={busy || !draft.weekly[i].length} title={`Copy ${day} hours`} aria-label={`Copy ${day} hours`} onClick={() => { setCopyTargets([]); setCopyDay(i); }}><Copy size={16} /></button></div>
            <Hours label={day} ranges={draft.weekly[i]} disabled={busy} onChange={(ranges) => patch({ weekly: draft.weekly.map((r, j) => i === j ? ranges : r) })} />
          </div>)}
        </div>
        <div className="grid gap-s4 content-start">
          <div><h3 className="h4">Date-specific hours</h3><p className="text-body-sm text-ink-3">Replace weekly hours for a particular date, or leave it unavailable for a day off. You can add multiple ranges; overlapping hours are combined.</p></div>
          <div className="flex flex-wrap gap-s2 items-end"><div className="flex-1 min-w-[150px]"><TextInput label="Date" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} /></div><Button small variant="secondary" disabled={busy || !date || draft.overrides.some((o) => o.date === date)} onClick={() => patch({ overrides: [...draft.overrides, { date, ranges: [] }].sort((a, b) => a.date.localeCompare(b.date)) })}><Plus size={16} />Add date</Button></div>
          {!draft.overrides.length && <p className="text-body-sm text-ink-3">No exceptions. Weekly hours apply.</p>}
          {draft.overrides.map((override) => <div key={override.date} className="border border-line p-s3 grid gap-s2">
            <div className="flex items-center justify-between gap-s2"><h4 className="font-semibold text-body-sm">{fmtDate(`${override.date}T12:00:00Z`, { year: true })}</h4><button type="button" className="tx-iconbtn" disabled={busy} title="Use weekly hours again" aria-label={`Remove override for ${override.date}`} onClick={() => patch({ overrides: draft.overrides.filter((o) => o.date !== override.date) })}><Trash2 size={16} /></button></div>
            <Hours label={override.date} ranges={override.ranges} disabled={busy} onChange={(ranges) => patch({ overrides: draft.overrides.map((o) => o.date === override.date ? { ...o, ranges } : o) })} />
          </div>)}
        </div>
      </div>
      <div className="grid gap-s3 sm:grid-cols-2 lg:grid-cols-4 border-t border-line pt-s4">
        <TextInput label="Publish from" type="date" value={draft.firstDate} disabled={busy} onChange={(e) => patch({ firstDate: e.target.value })} />
        <TextInput label="Publish through" type="date" value={draft.lastDate} disabled={busy} onChange={(e) => patch({ lastDate: e.target.value })} />
        <Select label="Interview length" value={draft.duration} disabled={busy} onChange={(e) => patch({ duration: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select>
        <Select label="Break between" value={draft.gap} disabled={busy} onChange={(e) => patch({ gap: Number(e.target.value) })}>{[0, 5, 10, 15].map((n) => <option key={n} value={n}>{n ? `${n} minutes` : 'No break'}</option>)}</Select>
        <div className="sm:col-span-2 lg:col-span-4"><TextInput label="Room or meeting link" value={draft.location} disabled={busy} onChange={(e) => patch({ location: e.target.value })} placeholder="C3.201 or a Meet link" /></div>
      </div>
      {preview.error ? <p className="tx-help" role="alert">{preview.error}</p> : <div className="grid gap-s2"><h3 className="h4">Slot preview · {preview.slots.length}</h3>{!preview.slots.length ? <p className="text-body-sm text-ink-3">Add hours on a weekday or a specific date to create future slots.</p> : <div className="max-h-[240px] overflow-y-auto grid gap-s2">{previewDays.map(([day, times]) => <p key={day} className="text-body-sm"><b>{fmtDate(`${day}T12:00:00Z`)}</b> · {times.length} slots · {times.slice(0, 4).map((s) => fmtTime(s.starts_at)).join(', ')}{times.length > 4 ? '…' : ''}</p>)}</div>}</div>}
      <p className="text-body-sm text-ink-3">Publishing adds new slots. Existing slots and booked interviews stay in place. Remove unwanted free slots from the schedule below.</p>
      {error && <p className="tx-help" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-s2"><Button variant="secondary" loading={busy} disabled={!!preview.error} onClick={() => save(false)}>Save hours</Button><Button loading={busy} disabled={!!preview.error || !preview.slots.length} onClick={() => save(true)}><Plus size={16} />Publish {preview.slots.length} slots</Button></div>
    </>}
    <Modal open={copyDay !== null} title={copyDay !== null ? `Copy ${WEEKDAYS[copyDay]} hours` : ''} onClose={() => setCopyDay(null)} actions={<><Button variant="secondary" onClick={() => setCopyDay(null)}>Cancel</Button><Button disabled={!copyTargets.length} onClick={() => { if (copyDay === null) return; patch({ weekly: draft.weekly.map((ranges, i) => copyTargets.includes(i) ? draft.weekly[copyDay].map((r) => ({ ...r })) : ranges) }); setCopyDay(null); }}>Copy hours</Button></>}>
      <p className="text-body-sm text-ink-2 mb-s3">Replace hours on the selected days.</p><div className="grid gap-s2">{WEEKDAYS.map((day, i) => i !== copyDay && <Check2 key={day} label={day} checked={copyTargets.includes(i)} onChange={(e) => setCopyTargets((ids) => e.target.checked ? [...ids, i] : ids.filter((id) => id !== i))} />)}</div>
    </Modal>
  </section>;
}
