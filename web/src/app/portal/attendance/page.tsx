'use client';
// Attendance (FR-7), one screen per stakeholder:
//   Associate  → My attendance: levels, sessions, excuses, QR check-in (7.3, 7.6, 7.7)
//   Executive  → Take attendance for OWN team, excuses to decide, own team's rates (7.4, 7.5, 7.7)
//   Curator    → Division rates, take attendance (incl. after 48 h), excuses (7.5)
//   Chairman   → Club rates, board meetings
// Executives and Curators also have their own record from board meetings.
import { ClipboardCheck, Plus, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { LevelBar, LevelChip, meetingTypeLabel, meetingTypeOne, SessionCard } from '@/components/portal/AttendanceBits';
import { NewMeetingModal } from '@/components/portal/NewMeetingModal';
import { usePortal } from '@/components/portal/PortalContext';
import { QrScanner } from '@/components/QrScanner';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { attendanceApi } from '@/lib/api/phase2';
import { fmtDate, fmtTime } from '@/lib/format';
import { takesAttendance } from '@/lib/roles';
import type { AttendanceSummary, Excuse, Meeting, MeetingType, MySession, RateRow } from '@/lib/types';

type Tab = 'mine' | 'take' | 'excuses' | 'rates';

function AttendanceInner() {
  const { me } = usePortal();
  const tabs: { value: Tab; label: string }[] = [];
  if (me.role !== 'chairman') tabs.push({ value: 'mine', label: me.role === 'associate' ? 'My attendance' : 'Mine' });
  if (takesAttendance(me)) tabs.push({ value: 'take', label: 'Take' }, { value: 'excuses', label: 'Excuses' }, { value: 'rates', label: me.role === 'executive' ? 'My team' : me.role === 'curator' ? 'Division' : 'Club' });
  const first: Tab = me.role === 'associate' ? 'mine' : me.role === 'executive' ? 'take' : 'rates';
  const [tab, setTab] = useState<Tab>(first);

  return (
    <>
      <PageTitle label={me.role === 'executive' ? `Attendance · ${me.team_name ?? ''}` : me.role === 'curator' ? `Attendance · ${me.division_name ?? ''}` : 'Attendance'}
        title={tab === 'mine' ? 'My attendance' : tab === 'take' ? 'Take attendance' : tab === 'excuses' ? 'Excuses' : 'Rates'} />
      {tabs.length > 1 && <div className="mb-s5 max-w-[560px]"><Segmented label="Attendance view" value={tab} onChange={setTab} options={tabs} /></div>}
      {tab === 'mine' && <Mine />}
      {tab === 'take' && <Take />}
      {tab === 'excuses' && <Excuses />}
      {tab === 'rates' && <Rates />}
    </>
  );
}

// ---------------------------------------------------------------- Mine
function Mine() {
  const toast = useToast();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [type, setType] = useState<MeetingType | ''>('');
  const [excuseFor, setExcuseFor] = useState<Meeting | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  const { me } = usePortal();

  const load = useCallback(() => {
    attendanceApi.attendanceSummary().then(setSummary).catch(() => setSummary({ overall_level: 0, types: [] }));
    attendanceApi.myAttendance(type || null).then(setSessions).catch(() => setSessions([]));
    attendanceApi.listMeetings().then(setMeetings).catch(() => {});
    attendanceApi.listExcuses().then((x) => setExcuses(x.filter((e) => e.user_id === me.id))).catch(() => {});
  }, [type, me.id]);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const marked = new Set((sessions ?? []).map((s) => s.meeting_id));
  const excused = new Set(excuses.map((e) => e.meeting_id));
  // Meetings you can still send an excuse for: upcoming, or up to 48 h after.
  const excusable = meetings.filter((m) => new Date(m.starts_at).getTime() + 48 * 3600_000 > now && !excused.has(m.id)
    && (me.role === 'associate' ? m.type !== 'board_meeting' : m.type === 'board_meeting'))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const openNow = meetings.filter((m) => { const t = new Date(m.starts_at).getTime(); return now > t - 30 * 60_000 && now < (m.ends_at ? new Date(m.ends_at).getTime() : t + 3 * 3600_000); });

  return (
    <div className="grid gap-s6">
      <div className="grid gap-s4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start">
        <section className="tx-card grid gap-s3" aria-labelledby="lvl">
          <div className="tx-label" id="lvl">Overall</div>
          {summary ? <>
            <div className="flex items-end justify-between gap-s3">
              <span className="stat tx-num">{summary.overall_level}</span>
              <LevelChip level={summary.overall_level} />
            </div>
            <LevelBar level={summary.overall_level} />
            <p className="text-caption text-ink-3">Each unexcused absence adds a level; every 2 lates count as one. Excused sessions never count.</p>
          </> : <Skeleton h={90} />}
        </section>
        <section className="tx-card grid gap-s2 content-start" aria-labelledby="bytype">
          <div className="tx-label" id="bytype">By type</div>
          {summary?.types.length === 0 && <p className="text-ink-3 text-body-sm">Nothing yet.</p>}
          <ul className="grid gap-s2">
            {summary?.types.map((t) => (
              <li key={t.type} className="flex items-center justify-between gap-s3 py-s1 border-b border-line last:border-0">
                <span className="grid">
                  <span className="font-semibold">{meetingTypeLabel[t.type]}</span>
                  <span className="text-caption text-ink-3">{t.attended} attended · {t.late} late · {t.absent} absent · {t.excused} excused</span>
                </span>
                <LevelChip level={t.level} short />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap gap-s2">
        <Button onClick={() => setCheckIn(true)}><ScanLine aria-hidden="true" />Check in to a meeting</Button>
        {openNow.length > 0 && <Chip kind="ok">{openNow.length} meeting{openNow.length > 1 ? 's' : ''} open now</Chip>}
      </div>

      {excusable.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="soon">
          <SectionHeading as="h3"><span id="soon">Can’t make it?</span></SectionHeading>
          <ul className="grid gap-s1">
            {excusable.slice(0, 4).map((m) => (
              <li key={m.id} className="tx-card flex items-center gap-s3" style={{ padding: '12px 16px' }}>
                <span className="flex-1 min-w-0"><span className="font-semibold block truncate">{m.title}</span><span className="text-caption text-ink-3">{fmtDate(m.starts_at)} · {fmtTime(m.starts_at)}{marked.has(m.id) ? ' · already marked' : ''}</span></span>
                <Button small variant="secondary" onClick={() => setExcuseFor(m)}>Send excuse</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-s3" aria-labelledby="sess">
        <div className="flex flex-wrap items-end gap-s3">
          <SectionHeading as="h3" className="flex-1"><span id="sess">Sessions ({sessions?.length ?? 0})</span></SectionHeading>
          <div className="w-full sm:w-[240px]">
            <Select label="Meeting type" value={type} onChange={(e) => setType(e.target.value as MeetingType | '')}>
              <option value="">All types</option>
              {Object.entries(meetingTypeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        </div>
        {sessions === null ? <Skeleton h={200} /> : sessions.length === 0
          ? <EmptyState title="Clean slate.">Your sessions show up here after your first meeting.</EmptyState>
          : <div className="tx-sessions">{sessions.map((s) => <SessionCard key={s.meeting_id} s={s} />)}</div>}
      </section>

      {excuses.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="myex">
          <SectionHeading as="h3"><span id="myex">My excuses</span></SectionHeading>
          <ul className="grid gap-s1">
            {excuses.map((e) => (
              <li key={e.id} className="tx-card flex items-center gap-s3" style={{ padding: '12px 16px' }}>
                <span className="flex-1 min-w-0"><span className="font-semibold block truncate">{meetings.find((m) => m.id === e.meeting_id)?.title ?? 'Meeting'}</span><span className="text-caption text-ink-3 truncate block">{e.note}</span></span>
                <Chip kind={e.status === 'accepted' ? 'ok' : e.status === 'rejected' ? 'bad' : 'pending'}>{e.status === 'pending' ? 'Pending' : e.status === 'accepted' ? 'Accepted' : 'Rejected'}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ExcuseModal meeting={excuseFor} onClose={() => setExcuseFor(null)} onSent={() => { setExcuseFor(null); toast('ok', 'Excuse sent.', 'Your executive will accept or reject it.'); load(); }} />
      <CheckInModal open={checkIn} meetings={openNow} onClose={() => setCheckIn(false)} onDone={() => { setCheckIn(false); load(); }} />
    </div>
  );
}

function ExcuseModal({ meeting, onClose, onSent }: { meeting: Meeting | null; onClose: () => void; onSent: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!meeting || !note.trim()) { setError('Say why you can’t make it.'); return; }
    setBusy(true);
    try { await attendanceApi.submitExcuse(meeting.id, note.trim()); setNote(''); setError(null); onSent(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!meeting} onClose={onClose} title={`Excuse for ${meeting?.title ?? ''}`}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} loading={busy}>Send</Button></>}>
      <p className="text-ink-2 mb-s4">{meeting ? `${fmtDate(meeting.starts_at)} · ${fmtTime(meeting.starts_at)}` : ''}. Accepted excuses never count toward your level.</p>
      <TextArea label="Reason" value={note} onChange={(e) => setNote(e.target.value)} error={error} rows={3} />
    </Modal>
  );
}

// Scan the meeting's screen, or type the 10-character code under it.
function CheckInModal({ open, meetings, onClose, onDone }: { open: boolean; meetings: Meeting[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [camera, setCamera] = useState(true);
  const [meetingId, setMeetingId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCamera(true); setMeetingId(meetings[0]?.id ?? ''); setCode(''); } }, [open, meetings]);

  const submit = async (mid: string, c: string) => {
    if (busy || !mid || !c) return;
    setBusy(true);
    try {
      const r = await attendanceApi.meetingCheckIn(mid, c);
      if (navigator.vibrate) navigator.vibrate(30);
      toast('ok', r.result === 'ok' ? (r.status === 'late' ? 'You’re in, marked late.' : 'You’re in.') : 'Already marked.', r.result === 'ok' ? undefined : `Your executive already marked you ${r.status}.`);
      onDone();
    } catch (e) {
      toast('bad', 'That didn’t work.', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // The meeting QR holds "<meeting id>:<code>".
  const onScan = (text: string) => {
    const [mid, c] = text.split(':');
    if (mid && c) { setCamera(false); submit(mid, c); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Check in to a meeting">
      <div className="grid gap-s4">
        <QrScanner active={open && camera} onCode={onScan} />
        <p className="text-body-sm text-ink-2">Point your camera at the QR on the meeting screen. It changes every 30 seconds, so scan it in the room.</p>
        <details className="grid gap-s3">
          <summary className="tx-link cursor-pointer text-body-sm">Camera not working? Type the code</summary>
          <div className="grid gap-s3 mt-s3">
            {meetings.length === 0 ? <p className="text-ink-3 text-body-sm">No meeting is open for check-in right now.</p> : <>
              <Select label="Meeting" value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                {meetings.map((m) => <option key={m.id} value={m.id}>{m.title} · {fmtTime(m.starts_at)}</option>)}
              </Select>
              <TextInput label="Code on the screen" value={code} onChange={(e) => setCode(e.target.value.trim().toLowerCase())} autoComplete="off" autoCapitalize="off" maxLength={10} />
              <Button onClick={() => submit(meetingId, code)} loading={busy} disabled={code.length < 10}>Check in</Button>
            </>}
          </div>
        </details>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Take
function Take() {
  const { me, team } = usePortal();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => attendanceApi.listMeetings().then(setMeetings).catch(() => setMeetings([])), []);
  useEffect(() => { load(); }, [load]);

  // Executives: only their own team's meetings and board meetings.
  const mine = (meetings ?? []).filter((m) => me.role !== 'executive' || m.team_id === me.team_id || m.type === 'board_meeting' || (!m.team_id && !m.division_id) || m.division_id === me.division_id);
  const now = Date.now();
  const upcoming = mine.filter((m) => new Date(m.starts_at).getTime() > now).reverse();
  const recent = mine.filter((m) => new Date(m.starts_at).getTime() <= now);
  const row = (m: Meeting) => (
    <li key={m.id}>
      <Link href={`/portal/attendance/meeting?id=${m.id}`} className="tx-card grid grid-cols-[minmax(0,1fr)_auto] gap-s3 items-center no-underline hover:bg-surface-2" style={{ padding: '12px 16px' }}>
        <span className="grid grid-cols-1 min-w-0">
          <span className="font-semibold truncate">{m.title}</span>
          <span className="text-caption text-ink-3 truncate">{meetingTypeOne[m.type]} · {m.team_id ? team(m.team_id)?.name : m.division_id ? 'Division' : 'Club-wide'} · {fmtDate(m.starts_at)} {fmtTime(m.starts_at)}{m.slot ? ` · ${m.slot}` : ''}</span>
        </span>
        <span className="tx-btn tx-btn--secondary tx-btn--sm"><ClipboardCheck aria-hidden="true" />{new Date(m.starts_at).getTime() > now ? 'Open' : 'Roll call'}</span>
      </Link>
    </li>
  );

  return (
    <div className="grid gap-s5">
      <div className="flex flex-wrap gap-s2">
        <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />Schedule a meeting</Button>
      </div>
      {meetings === null && <Skeleton h={200} />}
      {meetings && mine.length === 0 && <EmptyState title="No meetings yet.">Schedule your team’s first meeting; your associates see it on their calendar.</EmptyState>}
      {recent.length > 0 && <section className="grid gap-s2"><div className="tx-label">Recent</div><ul className="grid gap-s1">{recent.slice(0, 12).map(row)}</ul></section>}
      {upcoming.length > 0 && <section className="grid gap-s2"><div className="tx-label">Coming up</div><ul className="grid gap-s1">{upcoming.map(row)}</ul></section>}
      <NewMeetingModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />
    </div>
  );
}

// ---------------------------------------------------------------- Excuses
function Excuses() {
  const { me, memberName } = usePortal();
  const toast = useToast();
  const [list, setList] = useState<Excuse[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const load = useCallback(() => {
    attendanceApi.listExcuses().then((x) => setList(x.filter((e) => e.user_id !== me.id))).catch(() => setList([]));
    attendanceApi.listMeetings().then(setMeetings).catch(() => {});
  }, [me.id]);
  useEffect(() => { load(); }, [load]);
  const decide = async (e: Excuse, accept: boolean) => {
    try { await attendanceApi.decideExcuse(e.id, accept); toast('ok', accept ? 'Excuse accepted.' : 'Excuse rejected.', accept ? 'The session is marked excused.' : undefined); load(); }
    catch (x) { toast('bad', 'That didn’t save.', (x as Error).message); }
  };
  const pending = (list ?? []).filter((e) => e.status === 'pending');
  const done = (list ?? []).filter((e) => e.status !== 'pending');
  return (
    <div className="grid gap-s5">
      {list === null && <Skeleton h={160} />}
      {list && pending.length === 0 && <EmptyState title="No excuses waiting.">When someone in your {me.role === 'executive' ? 'team' : me.role === 'curator' ? 'division' : 'board'} can’t make it, their excuse lands here.</EmptyState>}
      <ul className="grid gap-s2">
        {pending.map((e) => {
          const m = meetings.find((x) => x.id === e.meeting_id);
          return (
            <li key={e.id} className="tx-card grid gap-s3">
              <div className="flex flex-wrap items-center gap-s2 justify-between">
                <span className="font-semibold">{memberName(e.user_id)}</span>
                <span className="text-caption text-ink-3">{m ? `${m.title} · ${fmtDate(m.starts_at)}` : ''}</span>
              </div>
              <p className="text-ink-2">{e.note}</p>
              <div className="grid grid-cols-2 gap-s2 sm:w-[360px]">
                <Button small variant="secondary" onClick={() => decide(e, false)}>Reject</Button>
                <Button small onClick={() => decide(e, true)}>Accept</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {done.length > 0 && (
        <section className="grid gap-s2"><div className="tx-label">Decided</div>
          <ul className="grid gap-s1">{done.slice(0, 10).map((e) => (
            <li key={e.id} className="flex items-center gap-s3 py-s2 border-b border-line">
              <span className="flex-1 min-w-0 truncate">{memberName(e.user_id)} · <span className="text-ink-3">{e.note}</span></span>
              <Chip kind={e.status === 'accepted' ? 'ok' : 'bad'}>{e.status === 'accepted' ? 'Accepted' : 'Rejected'}</Chip>
            </li>))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Rates
function Rates() {
  const { me, divisions } = usePortal();
  const [division, setDivision] = useState(me.role === 'curator' ? me.division_id ?? '' : '');
  const [rows, setRows] = useState<RateRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    const p = me.role === 'executive' ? attendanceApi.attendanceRates(me.team_id, null)
      : attendanceApi.attendanceRates(null, division || null);
    p.then((r) => setRows(r.sort((a, b) => b.level - a.level || (a.rate ?? 0) - (b.rate ?? 0)))).catch(() => setRows([]));
  }, [me, division]);
  const avg = useMemo(() => {
    const vals = (rows ?? []).map((r) => r.rate).filter((x): x is number => x !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [rows]);
  return (
    <div className="grid gap-s4">
      {me.role === 'chairman' && (
        <div className="w-full sm:w-[280px]">
          <Select label="Division" value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="">Whole club</option>
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-s2">
        <div className="tx-card tx-kpi"><span className="tx-label">Average rate</span><span className="stat tx-num">{avg === null ? '–' : `${avg}%`}</span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">At level 2+</span><span className="stat tx-num">{(rows ?? []).filter((r) => r.level >= 2).length}</span><span className="caption tx-faint">need a conversation</span></div>
      </div>
      {rows === null ? <Skeleton h={240} /> : rows.length === 0 ? <EmptyState title="No sessions yet.">Rates appear after the first roll call.</EmptyState> : (
        <table className="tx-table">
          <thead><tr><th>Member</th><th className="hidden sm:table-cell">Team</th><th className="tx-amt">Rate</th><th className="hidden md:table-cell tx-amt">Absent</th><th>Level</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td className="tx-strong">{r.name}<div className="sm:hidden text-caption text-ink-3 font-normal">{r.team}</div></td>
                <td className="hidden sm:table-cell">{r.team}</td>
                <td className="tx-amt">{r.rate === null ? '–' : `${r.rate}%`}</td>
                <td className="hidden md:table-cell tx-amt">{r.absent} · {r.late} late</td>
                <td><span className={`tx-lvl tx-lvl--${Math.min(r.level, 3)}`}>Level {r.level}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return <Suspense fallback={<Skeleton h={300} />}><AttendanceInner /></Suspense>;
}

