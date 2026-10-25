'use client';
// Attendance pieces from the design system: session cards (AttendanceSession),
// level chips and bars (StatusChip), status words with icons.
import { Check, Clock, Minus, X } from 'lucide-react';
import { fmtDate, fmtTime } from '@/lib/format';
import type { AttendanceStatus, MeetingType, MySession } from '@/lib/types';

export const meetingTypeLabel: Record<MeetingType, string> = {
  team_meeting: 'Team meetings',
  board_meeting: 'Board meetings',
  workshop: 'Workshops',
  general_assembly: 'General assemblies',
  event: 'Events',
  session: 'Sessions',
};

export const meetingTypeOne: Record<MeetingType, string> = {
  team_meeting: 'Team meeting', board_meeting: 'Board meeting', workshop: 'Workshop',
  general_assembly: 'General assembly', event: 'Event', session: 'Session',
};

export const statusInfo: Record<AttendanceStatus, { word: string; cls: 'ok' | 'bad' | 'warn' | 'void'; icon: typeof Check }> = {
  attended: { word: 'Attended', cls: 'ok', icon: Check },
  absent: { word: 'Absent', cls: 'bad', icon: X },
  late: { word: 'Late', cls: 'warn', icon: Clock },
  excused: { word: 'Excused', cls: 'void', icon: Minus },
};

export function StatusChip({ status }: { status: AttendanceStatus }) {
  const s = statusInfo[status];
  return <span className={`tx-chip tx-chip--${s.cls}`}><s.icon aria-hidden="true" />{s.word}</span>;
}

// Level 0 clear → 3 final review; higher counts still show as level 3.
export function LevelChip({ level, short = false }: { level: number; short?: boolean }) {
  const l = Math.min(Math.max(level, 0), 3);
  const words = ['Clear', 'Warning', 'Meeting with curator', 'Final review'];
  return <span className={`tx-lvl tx-lvl--${l} whitespace-nowrap`} title={words[l]}>Level {level}{short ? '' : ` · ${words[l]}`}</span>;
}

export function LevelBar({ level }: { level: number }) {
  return (
    <div className="tx-lvlbar" data-lvl={Math.min(level, 3)} role="img" aria-label={`Absence level ${level} of 3`}>
      <i /><i /><i />
    </div>
  );
}

export function SessionCard({ s, action }: { s: MySession; action?: React.ReactNode }) {
  const info = statusInfo[s.status];
  return (
    <div className={`tx-session tx-session--${info.cls}`}>
      <div className="tx-session__no" aria-hidden="true">{s.n}</div>
      <div className="min-w-0">
        <div className="tx-session__title truncate">{s.title}</div>
        <div className="tx-session__meta">
          {fmtDate(s.starts_at)} · {fmtTime(s.starts_at)}{s.slot ? ` · ${s.slot}` : ''}{s.note ? ` · ${s.note}` : ''}
        </div>
        {action}
      </div>
      <StatusChip status={s.status} />
    </div>
  );
}
