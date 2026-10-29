'use client';
// Task details: status steps, assignees, comments with @mentions (FR-6.2, FR-6.3).
import { AtSign, Check, CircleDot, Eye, RotateCcw, Send, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Chip, DivTag, Modal, TextArea } from '@/components/ui';
import { api } from '@/lib/api';
import { canAssignTask, isInTeam } from '@/lib/roles';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import type { Task, TaskComment, TaskStatus } from '@/lib/types';
import { isLate } from './KanbanCard';
import { usePortal } from './PortalContext';

const statusWord: Record<TaskStatus, string> = {
  requested: 'Request', todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done', declined: 'Declined',
};

export function TaskSheet({ task, canManage, onClose, onChanged }: { task: Task; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const { me, members, memberName, team, divisionOfTeam } = usePortal();
  const toast = useToast();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [editingAssignees, setEditingAssignees] = useState(false);
  const [assignees, setAssignees] = useState<string[]>(task.assignees);

  const loadComments = useCallback(() => api.listComments(task.id).then(setComments).catch(() => {}), [task.id]);
  useEffect(() => { loadComments(); setAssignees(task.assignees); }, [loadComments, task.assignees]);

  const teamMembers = members.filter((m) => canAssignTask(me, team(task.team_id), m));
  const isCreator = task.created_by === me.id;
  const isAssignee = task.assignees.includes(me.id);

  const move = async (status: TaskStatus, extra: Record<string, string> = {}) => {
    setBusy(status);
    try {
      await api.updateTask(task.id, { status, ...extra });
      toast('ok', status === 'done' ? 'Done. Nice.' : `Moved to ${statusWord[status].toLowerCase()}.`);
      onChanged();
      if (status === 'declined') onClose();
    } catch (e) {
      toast('bad', "That didn't save.", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!body.trim()) return;
    setBusy('comment');
    try {
      await api.addComment(task.id, body.trim(), mentions);
      setBody('');
      setMentions([]);
      loadComments();
    } catch (e) {
      toast('bad', "That didn't send.", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveAssignees = async () => {
    setBusy('assign');
    try {
      await api.setAssignees(task.id, assignees);
      setEditingAssignees(false);
      onChanged();
    } catch (e) {
      toast('bad', "That didn't save.", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Which moves to offer. The database checks again.
  const actions: { status: TaskStatus; label: string; icon: typeof Check; variant: 'primary' | 'secondary' }[] = [];
  if (task.status === 'requested') {
    if (canManage) actions.push({ status: 'todo', label: 'Accept', icon: Check, variant: 'primary' });
  } else if (canManage || isAssignee || isCreator) {
    if (task.status === 'todo') actions.push({ status: 'in_progress', label: 'Start', icon: CircleDot, variant: 'primary' });
    if (task.status === 'in_progress') actions.push({ status: 'in_review', label: 'Send to review', icon: Eye, variant: 'primary' });
    if (['in_progress', 'in_review'].includes(task.status) && (canManage || isCreator)) actions.push({ status: 'done', label: 'Mark done', icon: Check, variant: task.status === 'in_review' ? 'primary' : 'secondary' });
    if (['in_progress', 'in_review', 'done'].includes(task.status)) actions.push({ status: 'todo', label: 'Back to to do', icon: RotateCcw, variant: 'secondary' });
  }

  const d = divisionOfTeam(task.team_id);
  const mentionable = members.filter((m) => m.user_id !== me.id && (isInTeam(m, task.team_id) || task.assignees.includes(m.user_id) || m.role !== 'associate'));

  return (
    <Modal open onClose={onClose} title={task.title}>
      <div className="grid gap-s4">
        <div className="flex flex-wrap gap-s2 items-center">
          <DivTag kind={d?.kind}>{team(task.team_id)?.name}</DivTag>
          <Chip kind={task.status === 'done' ? 'ok' : task.status === 'requested' ? 'pending' : task.status === 'declined' ? 'bad' : 'soft'}>{statusWord[task.status]}</Chip>
          {isLate(task) && <Chip kind="bad">Late</Chip>}
          {task.priority !== 'normal' && <span className="tx-chip tx-chip--soft">{task.priority}</span>}
        </div>
        {task.requested_by_team_id && <p className="text-body-sm text-ink-2">Requested by {team(task.requested_by_team_id)?.name}.</p>}
        {task.description && <p className="text-ink-2 whitespace-pre-line">{task.description}</p>}
        <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-s3 gap-y-s2 text-body-sm">
          <dt className="tx-label pt-[2px]">Due</dt><dd>{task.deadline ? fmtDateTime(task.deadline) : 'No deadline'}</dd>
          <dt className="tx-label pt-[2px]">Created by</dt><dd>{memberName(task.created_by)}</dd>
          <dt className="tx-label pt-[6px]">Assignees</dt>
          <dd>
            {!editingAssignees ? (
              <div className="flex flex-wrap gap-s2 items-center">
                {task.assignees.map((a) => <span key={a} className="flex items-center gap-s1"><Avatar photo={members.find((m) => m.user_id === a)?.photo_url} name={memberName(a)} small />{memberName(a)}</span>)}
                {task.assignees.length === 0 && <span className="text-ink-3">Nobody yet</span>}
                {canManage && <button className="tx-link bg-transparent border-0 cursor-pointer" onClick={() => setEditingAssignees(true)}>Change</button>}
              </div>
            ) : (
              <div className="grid gap-s2">
                {teamMembers.map((m) => (
                  <label key={m.user_id} className="tx-check">
                    <input type="checkbox" checked={assignees.includes(m.user_id)}
                      onChange={(e) => setAssignees(e.target.checked ? [...assignees, m.user_id] : assignees.filter((x) => x !== m.user_id))} />
                    <span>{m.name}</span>
                  </label>
                ))}
                <div className="flex gap-s2"><Button small onClick={saveAssignees} loading={busy === 'assign'}>Save</Button><Button small variant="ghost" onClick={() => setEditingAssignees(false)}>Cancel</Button></div>
              </div>
            )}
          </dd>
        </dl>

        {actions.length > 0 && (
          <div className="grid grid-cols-2 gap-s2">
            {actions.map((a) => (
              <Button key={a.status + a.label} variant={a.variant} small loading={busy === a.status} onClick={() => move(a.status)}>
                <a.icon aria-hidden="true" />{a.label}
              </Button>
            ))}
            {task.status === 'requested' && canManage && <Button variant="danger" small onClick={() => setDeclining(true)}><X aria-hidden="true" />Decline</Button>}
          </div>
        )}
        {isAssignee && !canManage && !isCreator && task.status === 'in_review' && (
          <p className="text-caption text-ink-3">Your executive marks it done after review.</p>
        )}
        {declining && (
          <div className="grid gap-s2">
            <TextArea label="Why are you declining?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" small onClick={() => move('declined', { decline_reason: reason })} loading={busy === 'declined'}>Decline request</Button>
          </div>
        )}

        <section className="grid gap-s3 border-t border-line pt-s4" aria-labelledby="comments">
          <h3 id="comments" className="tx-label">Comments ({comments.length})</h3>
          <ul className="grid gap-s3">
            {comments.map((c) => (
              <li key={c.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-s2">
                <Avatar photo={members.find((m) => m.user_id === c.user_id)?.photo_url} name={memberName(c.user_id)} small />
                <div>
                  <div className="text-body-sm"><span className="font-semibold">{memberName(c.user_id)}</span> <span className="text-ink-3">{fmtRelative(c.created_at)}</span></div>
                  <p className="text-body-sm text-ink-2 whitespace-pre-line">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <TextArea label="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <div className="flex flex-wrap items-center gap-s2">
            <label className="flex items-center gap-s1 text-body-sm text-ink-2">
              <AtSign size={16} aria-hidden="true" />
              <span className="sr-only">Mention someone</span>
              <select className="tx-select" style={{ minHeight: 40, width: 'auto' }} value=""
                onChange={(e) => {
                  const m = members.find((x) => x.user_id === e.target.value);
                  if (!m) return;
                  setMentions((x) => [...new Set([...x, m.user_id])]);
                  setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}@${m.name.split(' ')[0]} `);
                }}>
                <option value="">Mention…</option>
                {mentionable.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
              </select>
            </label>
            <Button small onClick={send} loading={busy === 'comment'} disabled={!body.trim()} className="ml-auto"><Send aria-hidden="true" />Send</Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
