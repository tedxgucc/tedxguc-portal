'use client';
// Roll call for one meeting (FR-7.4): the Executive sees only their own
// associates, one tap each, "mark rest present", a note, then save.
// 48 h to correct; after that only the Curator. Optional rotating QR so
// associates check themselves in. Minutes and action items (FR-7.2).
import { Check, Clock, ListPlus, Lock, Minus, QrCode, Save, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { meetingTypeLabel, meetingTypeOne } from '@/components/portal/AttendanceBits';
import { usePortal } from '@/components/portal/PortalContext';
import { QR } from '@/components/Ticket';
import { useToast } from '@/components/Toast';
import { Avatar, Button, EmptyState, Modal, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { attendanceApi, saveMinutes } from '@/lib/api/phase2';
import { fmtDate, fmtTime } from '@/lib/format';
import { canManageTeam } from '@/lib/roles';
import type { AttendanceStatus, Meeting, RollRow } from '@/lib/types';

const OPTS: { s: AttendanceStatus; label: string; icon: typeof Check; cls: string }[] = [
  { s: 'attended', label: 'Here', icon: Check, cls: 'on-ok' },
  { s: 'late', label: 'Late', icon: Clock, cls: 'on-warn' },
  { s: 'absent', label: 'Absent', icon: X, cls: 'on-bad' },
  { s: 'excused', label: 'Excused', icon: Minus, cls: 'on-void' },
];

function RollCallPageInner() {
  const id = useSearchParams().get('id') ?? '';
  const { me, team, teams } = usePortal();
  const toast = useToast();
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [rows, setRows] = useState<RollRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    const all = await attendanceApi.listMeetings().catch(() => []);
    const m = all.find((x) => x.id === id) ?? null;
    setMeeting(m);
    setMinutes(m?.minutes ?? '');
    const r = await attendanceApi.rollCall(id).catch(() => []);
    setRows(r);
    setMarks(Object.fromEntries(r.filter((x) => x.status).map((x) => [x.user_id, x.status!])));
    setNotes(Object.fromEntries(r.filter((x) => x.note).map((x) => [x.user_id, x.note!])));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const editable = (rows ?? []).filter((r) => r.can_edit);
  const counts = useMemo(() => {
    const v = Object.values(marks);
    return { here: v.filter((x) => x === 'attended').length, late: v.filter((x) => x === 'late').length, absent: v.filter((x) => x === 'absent').length, excused: v.filter((x) => x === 'excused').length };
  }, [marks]);
  const isOrganiser = meeting && (meeting.team_id ? canManageTeam(me, teams.find((t) => t.id === meeting.team_id)) : me.role !== 'associate');

  const markRest = () => setMarks((m) => {
    const next = { ...m };
    for (const r of editable) if (!next[r.user_id]) next[r.user_id] = 'attended';
    return next;
  });

  const save = async () => {
    const list = editable.filter((r) => marks[r.user_id] && (marks[r.user_id] !== r.status || (notes[r.user_id] ?? '') !== (r.note ?? '')))
      .map((r) => ({ user_id: r.user_id, status: marks[r.user_id], note: notes[r.user_id] }));
    if (!list.length) { toast('warn', 'Nothing changed.'); return; }
    setBusy(true);
    try {
      await attendanceApi.submitAttendance(id, list);
      toast('ok', `Saved: ${counts.here} here, ${counts.late} late, ${counts.absent} absent.`, counts.excused ? `${counts.excused} excused.` : undefined);
      load();
    } catch (e) {
      toast('bad', 'That didn’t save.', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addAction = async () => {
    if (!action.trim() || !meeting?.team_id) return;
    try {
      await api.createTask({ team_id: meeting.team_id, title: action.trim(), priority: 'normal', assignees: [], description: `From ${meeting.title}, ${fmtDate(meeting.starts_at)}` });
      setAction('');
      toast('ok', 'Action item added to Tasks.');
    } catch (e) {
      toast('bad', 'That didn’t save.', (e as Error).message);
    }
  };

  if (meeting === undefined) return <Skeleton h={320} />;
  if (meeting === null) return <EmptyState title="We can’t find that meeting." action={<Link href="/portal/attendance" className="tx-btn tx-btn--secondary">Back to attendance</Link>} />;
  const unmarked = editable.filter((r) => !marks[r.user_id]).length;

  return (
    <>
      <PageTitle label={`${meetingTypeOne[meeting.type]} · ${meeting.team_id ? team(meeting.team_id)?.name : meeting.division_id ? 'Division' : 'Whole club'}`} title={meeting.title}>
        {isOrganiser && <Button variant="secondary" onClick={() => setQr(true)}><QrCode aria-hidden="true" />Show QR</Button>}
      </PageTitle>
      <p className="text-ink-2 -mt-s4 mb-s5">{fmtDate(meeting.starts_at, { year: true })} · {fmtTime(meeting.starts_at)}{meeting.slot ? ` · ${meeting.slot}` : ''}{meeting.location ? ` · ${meeting.location}` : ''}</p>

      <div className="grid gap-s6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="grid gap-s3" aria-labelledby="roll">
          <div className="flex flex-wrap items-center justify-between gap-s2">
            <h2 id="roll" className="tx-label">Roll call ({rows?.length ?? 0})</h2>
            {unmarked > 0 && <Button small variant="secondary" onClick={markRest}><Check aria-hidden="true" />Mark rest present</Button>}
          </div>
          {rows === null ? <Skeleton h={240} /> : rows.length === 0
            ? <EmptyState title="Nobody to mark here.">{me.role === 'executive' ? 'Only your own team’s associates show up for you.' : 'No one in your scope is expected at this meeting.'}</EmptyState>
            : (
              <div>
                {rows.map((r) => {
                  const cur = marks[r.user_id];
                  return (
                    <div key={r.user_id} className="tx-roll">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <div className="tx-roll__name truncate">{r.name}</div>
                        <div className="tx-roll__team">
                          {r.team}{r.via === 'qr' ? ' · scanned in' : r.via === 'excuse' ? ' · excuse accepted' : ''}
                          {!r.can_edit && <span className="inline-flex items-center gap-[2px] ml-s1"><Lock size={11} aria-hidden="true" />locked after 48 h</span>}
                          {notes[r.user_id] && <span> · “{notes[r.user_id]}”</span>}
                        </div>
                      </div>
                      <div className="tx-roll__opts" role="radiogroup" aria-label={`Attendance for ${r.name}`}>
                        {OPTS.map((o) => (
                          <button key={o.s} type="button" role="radio" aria-checked={cur === o.s} disabled={!r.can_edit}
                            className={cur === o.s ? o.cls : ''} onClick={() => setMarks((m) => ({ ...m, [r.user_id]: o.s }))}
                            onDoubleClick={() => setNoteFor(r.user_id)}>
                            <o.icon aria-hidden="true" />{o.label}
                          </button>
                        ))}
                      </div>
                      {r.can_edit && <button className="tx-link text-caption bg-transparent border-0 cursor-pointer justify-self-start col-span-full -mt-s1" onClick={() => setNoteFor(r.user_id)}>{notes[r.user_id] ? 'Edit note' : 'Add note'}</button>}
                    </div>
                  );
                })}
                <div className="sticky bottom-[72px] lg:bottom-s4 mt-s4 tx-card flex items-center justify-between gap-s3" style={{ boxShadow: 'var(--shadow-pop)' }}>
                  <span className="text-body-sm text-ink-2">{counts.here} here · {counts.late} late · {counts.absent} absent{unmarked ? ` · ${unmarked} not marked` : ''}</span>
                  <Button onClick={save} loading={busy} disabled={!editable.length}><Save aria-hidden="true" />Mark attendance</Button>
                </div>
                {me.role === 'executive' && <p className="text-caption text-ink-3 mt-s3">You can correct marks for 48 hours after you first save them. After that, ask your curator.</p>}
              </div>
            )}
        </section>

        <aside className="grid gap-s4" aria-label="Meeting notes">
          {meeting.agenda && <section className="tx-card grid gap-s2"><div className="tx-label">Agenda</div><p className="text-ink-2 whitespace-pre-line">{meeting.agenda}</p></section>}
          {isOrganiser ? (
            <section className="tx-card grid gap-s3">
              <TextArea label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={5} />
              <Button small variant="secondary" onClick={async () => { try { await saveMinutes(id, minutes); toast('ok', 'Minutes saved.'); } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } }}>Save minutes</Button>
              {meeting.team_id && <>
                <TextInput label="Action item → task" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Send shot list to L&P" />
                <Button small onClick={addAction} disabled={!action.trim()}><ListPlus aria-hidden="true" />Add to tasks</Button>
              </>}
            </section>
          ) : meeting.minutes && <section className="tx-card grid gap-s2"><div className="tx-label">Minutes</div><p className="text-ink-2 whitespace-pre-line">{meeting.minutes}</p></section>}
        </aside>
      </div>

      <NoteModal open={!!noteFor} name={rows?.find((r) => r.user_id === noteFor)?.name ?? ''} value={noteFor ? notes[noteFor] ?? '' : ''}
        onClose={() => setNoteFor(null)} onSave={(v) => { if (noteFor) setNotes((n) => ({ ...n, [noteFor]: v })); setNoteFor(null); }} />
      {qr && <QrModal meeting={meeting} onClose={() => setQr(false)} />}
    </>
  );
}

function NoteModal({ open, name, value, onClose, onSave }: { open: boolean; name: string; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value, open]);
  return (
    <Modal open={open} onClose={onClose} title={`Note for ${name}`}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(v.trim())}>Keep note</Button></>}>
      <TextInput label="Note (optional)" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. left early" />
      <p className="text-caption text-ink-3 mt-s2">Saved with the next “Mark attendance”.</p>
    </Modal>
  );
}

// The QR holds "<meeting id>:<code>" and changes every 30 seconds, so a
// screenshot sent to a friend outside the room stops working.
function QrModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [code, setCode] = useState<{ code: string; valid_for_seconds: number } | null>(null);
  const [left, setLeft] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const c = await attendanceApi.meetingQr(meeting.id);
        setCode(c);
        setLeft(c.valid_for_seconds);
        timer = setTimeout(tick, c.valid_for_seconds * 1000 + 200);
      } catch (e) { setErr((e as Error).message); }
    };
    tick();
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => { clearTimeout(timer); clearInterval(t); };
  }, [meeting.id]);
  return (
    <Modal open onClose={onClose} title="Scan to check in">
      <div className="grid justify-items-center gap-s3 text-center">
        {err ? <p className="text-bad">{err}</p> : code ? (
          <>
            <div className="bg-[#fff] p-s3" style={{ width: 260 }}><QR value={`${meeting.id}:${code.code}`} label="Meeting check-in QR" /></div>
            <div className="code text-h4 tracking-[0.2em]">{code.code}</div>
            <p className="text-caption text-ink-3">New code in {left}s. Late after 15 minutes from the start.</p>
          </>
        ) : <Skeleton h={260} w={260} />}
      </div>
    </Modal>
  );
}

export default function RollCallPage() {
  return <Suspense><RollCallPageInner /></Suspense>;
}
