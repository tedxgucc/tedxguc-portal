'use client';
// Event setup (FR-5): registration questions and door staff for the event
// managers (Chairman, Operations Curator); the run of show, which event
// managers and L&P Executives edit and every member can read.
import { ArrowDown, ArrowUp, Pencil, Plus, Printer, Trash2, UserMinus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { adminApi, type RunItem, type RunItemInput, type StaffRow } from '@/lib/api/admin';
import { fmtDate, fmtTime, fromLocalInput, toLocalInput } from '@/lib/format';
import { canEditRunOfShow, canScanAlways, roleLabel } from '@/lib/roles';
import type { EventField, Me, TxEvent } from '@/lib/types';

const kindLabel: Record<EventField['kind'], string> = { text: 'Short answer', textarea: 'Long answer', select: 'Choice', checkbox: 'Tick box', number: 'Number' };
type FieldDraft = Omit<EventField, 'id'> & { id?: string; optionsText: string };

// ---------------------------------------------------------------- questions
export function QuestionsSection({ event }: { event: TxEvent }) {
  const toast = useToast();
  const [fields, setFields] = useState<EventField[] | null>(null);
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.getEventFields(event.id).then((f) => setFields([...f].sort((a, b) => a.position - b.position))).catch(() => setFields([])); }, [event.id]);
  useEffect(() => { load(); }, [load]);
  if (!fields) return <Skeleton h={160} />;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const { optionsText, ...row } = draft;
      await adminApi.saveEventField({ ...row, options: draft.kind === 'select' ? optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : [] });
      toast('ok', draft.id ? 'Question updated' : 'Question added', 'It shows on the registration form now.');
      setDraft(null);
      load();
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(false); }
  };
  const remove = async (f: EventField) => {
    try { await adminApi.deleteEventField(f.id); load(); } catch (e) { toast('bad', 'Couldn’t remove', (e as Error).message); }
  };
  // Swap positions with the neighbour.
  const move = async (i: number, dir: -1 | 1) => {
    const a = fields[i];
    const b = fields[i + dir];
    if (!a || !b) return;
    try {
      await adminApi.saveEventField({ ...a, position: b.position });
      await adminApi.saveEventField({ ...b, position: a.position });
      load();
    } catch (e) { toast('bad', 'Couldn’t reorder', (e as Error).message); }
  };
  const blank = (): FieldDraft => ({ event_id: event.id, position: (fields.at(-1)?.position ?? 0) + 1, label: '', kind: 'text', required: false, options: [], optionsText: '' });

  return (
    <section className="grid gap-s3 max-w-[760px]" aria-label="Registration questions">
      <p className="text-ink-2 text-body-sm">Guests always give their name, email and phone. Add anything else you need to know. Guests who already registered keep their answers.</p>
      {fields.length === 0 ? <EmptyState title="No extra questions">The form asks only for name, email and phone.</EmptyState> : (
        <ol className="grid gap-s2">
          {fields.map((f, i) => (
            <li key={f.id} className="tx-card flex items-center gap-s3">
              <span className="grid gap-s1 flex-1 min-w-0">
                <span className="font-semibold">{f.label}{f.required && <span className="text-accent" aria-label="required"> *</span>}</span>
                <span className="caption tx-faint">{kindLabel[f.kind]}{f.kind === 'select' ? ` · ${f.options.join(', ')}` : ''}</span>
              </span>
              <span className="flex items-center gap-s1 shrink-0">
                <button type="button" className="tx-iconbtn" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="tx-iconbtn" aria-label={`Move ${f.label} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="tx-iconbtn" aria-label={`Edit ${f.label}`} onClick={() => setDraft({ ...f, optionsText: f.options.join('\n') })}><Pencil size={16} /></button>
                <button type="button" className="tx-iconbtn" aria-label={`Remove ${f.label}`} onClick={() => remove(f)}><Trash2 size={16} /></button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div><Button variant="secondary" small onClick={() => setDraft(blank())}><Plus size={16} aria-hidden="true" />Add question</Button></div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit question' : 'New question'}
        actions={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {draft && (
          <div className="grid gap-s4">
            <TextInput label="Question" value={draft.label} maxLength={120} autoFocus onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <Select label="Answer type" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventField['kind'] })}>
              {Object.entries(kindLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            {draft.kind === 'select' && <TextArea label="Options" help="One per line, at least two." rows={4} value={draft.optionsText} onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })} />}
            <Check2 label="Guests must answer" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} />
          </div>
        )}
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------- door staff
export function StaffSection({ event }: { event: TxEvent }) {
  const { members } = usePortal();
  const toast = useToast();
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [pick, setPick] = useState('');
  const load = useCallback(() => { adminApi.listStaff(event.id).then(setRows).catch(() => setRows([])); }, [event.id]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Skeleton h={160} />;

  const asMe = (m: (typeof members)[number]): Me => ({ id: m.user_id, name: m.name, email: '', photo_url: null, role: m.role, team_id: m.team_id, team_name: m.team, team_kind: null, division_id: m.division_id, division_name: m.division, division_kind: m.division_kind });
  const staff = rows.map((r) => members.find((m) => m.user_id === r.user_id)).filter(Boolean) as typeof members;
  const candidates = members.filter((m) => !rows.some((r) => r.user_id === m.user_id) && !canScanAlways(asMe(m))).sort((a, b) => a.name.localeCompare(b.name));
  const set = async (userId: string, on: boolean) => {
    try {
      await adminApi.setStaff(event.id, userId, on);
      toast('ok', on ? 'Added to the door team' : 'Removed from the door team', on ? 'They can scan tickets for this event.' : undefined);
      setPick('');
      load();
    } catch (e) { toast('bad', 'Couldn’t update', (e as Error).message); }
  };

  return (
    <section className="grid gap-s4 max-w-[760px]" aria-label="Door staff">
      <p className="text-ink-2 text-body-sm">The Chairman, the Operations Curator and L&P Executives can always scan; L&P Associates can on the day. Add anyone else who works the door at {event.title}.</p>
      {staff.length === 0 ? <EmptyState title="No extra door staff">Only Operations leads and L&P can scan for this event.</EmptyState> : (
        <ul className="grid gap-s2">
          {staff.map((m) => (
            <li key={m.user_id} className="tx-card flex items-center gap-s3">
              <Avatar name={m.name} small />
              <span className="flex-1 min-w-0"><span className="font-semibold">{m.name}</span><span className="caption tx-faint block">{roleLabel[m.role]}{m.team ? ` · ${m.team}` : ''}</span></span>
              <button type="button" className="tx-iconbtn" aria-label={`Remove ${m.name} from the door team`} onClick={() => set(m.user_id, false)}><UserMinus size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-s2">
        <div className="w-full sm:w-[320px]">
          <Select label="Add someone" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a member</option>
            {candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.team ? ` · ${m.team}` : ''}</option>)}
          </Select>
        </div>
        <Button disabled={!pick} onClick={() => set(pick, true)}><Plus size={16} aria-hidden="true" />Add to door</Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- run of show
type RunDraft = RunItemInput & { start: string; end: string };

export function RunOfShowSection({ event }: { event: TxEvent }) {
  const { me, members, memberName } = usePortal();
  const toast = useToast();
  const edit = canEditRunOfShow(me);
  const [rows, setRows] = useState<RunItem[] | null>(null);
  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { adminApi.listRunOfShow(event.id).then(setRows).catch(() => setRows([])); }, [event.id]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Skeleton h={200} />;

  const open = (r?: RunItem) => {
    const last = rows.at(-1);
    const start = r?.starts_at ?? last?.ends_at ?? last?.starts_at ?? event.starts_at;
    setDraft({
      id: r?.id, event_id: event.id, position: r?.position ?? (last?.position ?? 0) + 1, item: r?.item ?? '', owner_id: r?.owner_id ?? null, notes: r?.notes ?? null,
      starts_at: start, ends_at: r?.ends_at ?? null, start: toLocalInput(start), end: r?.ends_at ? toLocalInput(r.ends_at) : '',
    });
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.start) { toast('bad', 'Add a start time'); return; }
    setBusy(true);
    try {
      const { start, end, ...row } = draft;
      await adminApi.saveRunItem({ ...row, starts_at: fromLocalInput(start), ends_at: end ? fromLocalInput(end) : null, notes: draft.notes?.trim() || null });
      setDraft(null);
      load();
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(false); }
  };
  const remove = async (r: RunItem) => {
    try { await adminApi.deleteRunItem(r.id); load(); } catch (e) { toast('bad', 'Couldn’t remove', (e as Error).message); }
  };
  const now = Date.now();
  const isNow = (r: RunItem) => new Date(r.starts_at).getTime() <= now && (r.ends_at ? new Date(r.ends_at).getTime() > now : false);

  return (
    <section className="grid gap-s4 max-w-[860px]" aria-label="Run of show">
      <div className="flex flex-wrap items-center justify-between gap-s2">
        <p className="text-ink-2 text-body-sm">{fmtDate(event.starts_at, { year: true })}. {edit ? 'You can edit this; everyone in the club can read it.' : 'Event managers and L&P Executives keep this up to date.'}</p>
        <div className="flex gap-s2 print:hidden">
          {rows.length > 0 && <Button variant="ghost" small onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print</Button>}
          {edit && <Button small onClick={() => open()}><Plus size={16} aria-hidden="true" />Add slot</Button>}
        </div>
      </div>
      {rows.length === 0 ? <EmptyState title="No run of show yet">{edit ? 'Add the first slot: crew call, doors, opening…' : 'It shows here once L&P adds it.'}</EmptyState> : (
        <ol className="grid">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-s3 py-s3 border-b border-line items-start">
              <span className="tx-num font-semibold">{fmtTime(r.starts_at)}{r.ends_at && <span className="caption tx-faint block">to {fmtTime(r.ends_at)}</span>}</span>
              <span className="grid gap-s1 min-w-0">
                <span className="font-semibold flex flex-wrap items-center gap-s2">{r.item}{isNow(r) && <Chip kind="ok">Now</Chip>}</span>
                {r.owner_id && <span className="caption tx-faint">Owner: {memberName(r.owner_id)}</span>}
                {r.notes && <span className="text-body-sm text-ink-2">{r.notes}</span>}
              </span>
              {edit ? (
                <span className="flex gap-s1 print:hidden">
                  <button type="button" className="tx-iconbtn" aria-label={`Edit ${r.item}`} onClick={() => open(r)}><Pencil size={16} /></button>
                  <button type="button" className="tx-iconbtn" aria-label={`Remove ${r.item}`} onClick={() => remove(r)}><Trash2 size={16} /></button>
                </span>
              ) : <span />}
            </li>
          ))}
        </ol>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit slot' : 'New slot'}
        actions={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {draft && (
          <div className="grid gap-s4">
            <TextInput label="What happens" value={draft.item} maxLength={120} autoFocus onChange={(e) => setDraft({ ...draft, item: e.target.value })} />
            <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
              <TextInput label="Starts" type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <TextInput label="Ends (optional)" type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
            <Select label="Owner" value={draft.owner_id ?? ''} onChange={(e) => setDraft({ ...draft, owner_id: e.target.value || null })}>
              <option value="">No one</option>
              {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.team ? ` · ${m.team}` : ''}</option>)}
            </Select>
            <TextArea label="Notes (optional)" rows={2} maxLength={400} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        )}
      </Modal>
    </section>
  );
}
