'use client';
// Task card (design system: KanbanCard): 3px top edge in the owning
// division's colour, title, team tag, assignees, due date. Overdue says
// "Late" in words, not colour alone.
import { divClass } from '@/lib/roles';
import { fmtShortDate } from '@/lib/format';
import type { Task } from '@/lib/types';
import { Avatar, DivTag } from '@/components/ui';
import { usePortal } from './PortalContext';

export const isLate = (t: Task) => !!t.deadline && new Date(t.deadline) < new Date() && !['done', 'declined'].includes(t.status);

export function KanbanCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { team, divisionOfTeam, memberName, members } = usePortal();
  const d = divisionOfTeam(task.team_id);
  const c = divClass(d?.kind);
  const late = isLate(task);
  const done = task.status === 'done';
  return (
    <button onClick={() => onOpen(task)} className={`tx-kcard ${c ? `tx-kcard--${c}` : ''} text-left w-full cursor-pointer hover:bg-surface-3 transition-colors duration-1`}
      aria-label={`${task.title}${late ? ', late' : ''}`}>
      <div className="flex flex-wrap gap-s1">
        <DivTag kind={d?.kind}>{team(task.team_id)?.name ?? 'Team'}</DivTag>
        {task.priority === 'urgent' && <span className="tx-chip tx-chip--bad" style={{ height: 24 }}>Urgent</span>}
        {task.priority === 'high' && <span className="tx-chip tx-chip--soft" style={{ height: 24 }}>High</span>}
        {task.status === 'requested' && <span className="tx-chip tx-chip--warn" style={{ height: 24 }}>Request</span>}
      </div>
      <div className="tx-kcard__title" style={done ? { color: 'var(--ink-3)', textDecoration: 'line-through' } : undefined}>{task.title}</div>
      <div className="tx-kcard__foot">
        <span className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((a) => <Avatar photo={members.find((m) => m.user_id === a)?.photo_url} key={a} name={memberName(a)} small />)}
          {task.assignees.length === 0 && <span className="text-ink-3">Unassigned</span>}
        </span>
        {task.deadline && (
          <span className={`tx-kcard__due ${late ? 'is-late' : ''}`}>{late ? `Late · ${fmtShortDate(task.deadline)}` : `Due ${fmtShortDate(task.deadline)}`}</span>
        )}
      </div>
    </button>
  );
}
