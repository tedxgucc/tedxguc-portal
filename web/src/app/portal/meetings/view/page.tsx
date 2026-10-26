'use client';
// One meeting (FR-7.2): when and where, the agenda, the minutes, and action
// items that become tasks. The organiser writes the minutes; everyone
// invited reads them.
import { ArrowLeft, ListPlus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { meetingTypeOne } from '@/components/portal/AttendanceBits';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { attendanceApi, saveMinutes } from '@/lib/api/phase2';
import { fmtDate, fmtTime } from '@/lib/format';
import { canManageTeam } from '@/lib/roles';
import type { Meeting } from '@/lib/types';

function MeetingInner() {
  const id = useSearchParams().get('id') ?? '';
  const { me, team, teams } = usePortal();
  const toast = useToast();
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [minutes, setMinutes] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const all = await attendanceApi.listMeetings().catch(() => [] as Meeting[]);
    const m = all.find((x) => x.id === id) ?? null;
    setMeeting(m);
    setMinutes(m?.minutes ?? '');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (meeting === undefined) return <Skeleton h={320} />;
  if (meeting === null) return <EmptyState title="We can’t find that meeting." action={<Link href="/portal/meetings" className="tx-btn tx-btn--secondary">All meetings</Link>} />;
  const organiser = meeting.team_id ? canManageTeam(me, teams.find((t) => t.id === meeting.team_id)) : me.role === 'chairman' || me.role === 'curator';

  const save = async () => {
    setBusy(true);
    try { await saveMinutes(id, minutes); toast('ok', 'Minutes saved.', 'Everyone invited can read them.'); load(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  const addAction = async () => {
    if (!action.trim() || !meeting.team_id) return;
    try {
      await api.createTask({ team_id: meeting.team_id, title: action.trim(), priority: 'normal', assignees: [], description: `From ${meeting.title}, ${fmtDate(meeting.starts_at)}` });
      setAction('');
      toast('ok', 'Action item added to Tasks.');
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };

  return (
    <>
      <Link href="/portal/meetings" className="inline-flex items-center gap-s1 text-body-sm text-ink-2 no-underline mb-s3"><ArrowLeft size={16} aria-hidden="true" />All meetings</Link>
      <PageTitle label={`${meetingTypeOne[meeting.type]} · ${meeting.team_id ? team(meeting.team_id)?.name : meeting.division_id ? 'Division' : 'Whole club'}`} title={meeting.title} />
      <p className="text-ink-2 -mt-s4 mb-s5">{fmtDate(meeting.starts_at, { year: true })} · {fmtTime(meeting.starts_at)}{meeting.ends_at ? `–${fmtTime(meeting.ends_at)}` : ''}{meeting.slot ? ` · ${meeting.slot}` : ''}{meeting.location ? ` · ${meeting.location}` : ''}
        {meeting.online_url && <> · <a className="tx-link" href={meeting.online_url} target="_blank" rel="noopener noreferrer">Join online</a></>}</p>

      <div className="grid gap-s5 lg:grid-cols-2 lg:items-start max-w-[1000px]">
        <section className="tx-card grid gap-s2">
          <div className="tx-label">Agenda</div>
          {meeting.agenda ? <p className="text-ink-2 whitespace-pre-line">{meeting.agenda}</p> : <p className="text-ink-3">No agenda yet.</p>}
        </section>
        {organiser ? (
          <section className="tx-card grid gap-s3">
            <TextArea label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={7} placeholder="What was decided, who does what." />
            <Button small variant="secondary" className="justify-self-start" loading={busy} onClick={save}>Save minutes</Button>
            {meeting.team_id && (
              <>
                <TextInput label="Action item → task" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Send shot list to L&P" />
                <Button small className="justify-self-start" onClick={addAction} disabled={!action.trim()}><ListPlus aria-hidden="true" />Add to tasks</Button>
              </>
            )}
          </section>
        ) : (
          <section className="tx-card grid gap-s2">
            <div className="tx-label">Minutes</div>
            {meeting.minutes ? <p className="text-ink-2 whitespace-pre-line">{meeting.minutes}</p> : <p className="text-ink-3">Minutes appear here after the meeting.</p>}
          </section>
        )}
      </div>
    </>
  );
}

export default function MeetingPage() {
  return <Suspense><MeetingInner /></Suspense>;
}
