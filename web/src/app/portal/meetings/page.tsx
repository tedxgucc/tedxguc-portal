'use client';
// Meetings (FR-7.1, FR-7.2): what's coming up and what happened, with
// agenda and minutes. Executives schedule their team's meetings, Curators
// their division's, the Chairman any. No attendance is taken.
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { meetingTypeOne } from '@/components/portal/AttendanceBits';
import { NewMeetingModal } from '@/components/portal/NewMeetingModal';
import { usePortal } from '@/components/portal/PortalContext';
import { Button, Chip, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { attendanceApi } from '@/lib/api/phase2';
import { fmtTime } from '@/lib/format';
import type { Meeting } from '@/lib/types';

export default function MeetingsPage() {
  const { me, team } = usePortal();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const load = useCallback(() => { attendanceApi.listMeetings().then(setMeetings).catch(() => setMeetings([])); }, []);
  useEffect(() => { load(); }, [load]);
  const canSchedule = me.role === 'executive' || me.role === 'curator' || me.role === 'chairman';

  const now = Date.now();
  const upcoming = (meetings ?? []).filter((m) => new Date(m.ends_at ?? m.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = (meetings ?? []).filter((m) => new Date(m.ends_at ?? m.starts_at).getTime() < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const shown = when === 'upcoming' ? upcoming : past;
  const scope = (m: Meeting) => (m.team_id ? team(m.team_id)?.name ?? 'Team' : m.division_id ? 'Division' : 'Whole club');

  return (
    <>
      <PageTitle label="Meetings" title={when === 'upcoming' ? 'Coming up' : 'Past meetings'}>
        {canSchedule && <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />Schedule a meeting</Button>}
      </PageTitle>
      <div className="mb-s5 w-full sm:w-[320px]">
        <Segmented label="Which meetings" value={when} onChange={setWhen} options={[{ value: 'upcoming', label: `Coming up ${upcoming.length}` }, { value: 'past', label: 'Past' }]} />
      </div>
      {meetings === null ? <Skeleton h={240} /> : shown.length === 0 ? (
        <EmptyState title={when === 'upcoming' ? 'No meetings coming up' : 'No past meetings'}>
          {canSchedule ? 'Schedule one; everyone invited sees it here and on their calendar.' : 'Meetings for your team and the club show up here.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-s2 max-w-[860px]">
          {shown.map((m) => (
            <li key={m.id}>
              <Link href={`/portal/meetings/view?id=${m.id}`} className="tx-card grid grid-cols-[64px_minmax(0,1fr)_auto] gap-s3 items-center no-underline hover:bg-surface-2">
                <span className="grid justify-items-center text-center leading-none">
                  <span className="tx-label">{new Date(m.starts_at).toLocaleDateString('en-GB', { month: 'short', timeZone: 'Africa/Cairo' })}</span>
                  <span className="font-display text-[32px]">{new Date(m.starts_at).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Africa/Cairo' })}</span>
                </span>
                <span className="grid min-w-0 gap-s1">
                  <span className="font-semibold truncate">{m.title}</span>
                  <span className="text-caption text-ink-3 truncate">{meetingTypeOne[m.type]} · {scope(m)} · {fmtTime(m.starts_at)}{m.location ? ` · ${m.location}` : ''}</span>
                </span>
                <span className="flex items-center gap-s2">
                  {when === 'past' && (m.minutes ? <Chip kind="ok">Minutes</Chip> : <Chip kind="soft">No minutes</Chip>)}
                  <ArrowRight size={18} className="text-ink-3" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canSchedule && <NewMeetingModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </>
  );
}
