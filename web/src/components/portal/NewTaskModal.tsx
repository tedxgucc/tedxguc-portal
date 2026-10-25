'use client';
// New task for a team you manage, or a request to another team (FR-6.1, FR-6.5).
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Modal, Segmented, Select, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { fromLocalInput } from '@/lib/format';
import { canSendTaskRequests, manageableTeams } from '@/lib/roles';
import type { TaskPriority } from '@/lib/types';
import { usePortal } from './PortalContext';

export function NewTaskModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { me, teams, members } = usePortal();
  const toast = useToast();
  const mine = useMemo(() => manageableTeams(me, teams), [me, teams]);
  const [mode, setMode] = useState<'task' | 'request'>('task');
  const [teamId, setTeamId] = useState('');
  const [fromTeam, setFromTeam] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('task'); setTitle(''); setDescription(''); setDeadline(''); setPriority('normal'); setAssignees([]); setError(null);
    setTeamId(mine[0]?.id ?? ''); setFromTeam(mine[0]?.id ?? '');
  }, [open, mine]);

  const targetTeams = mode === 'task' ? mine : teams.filter((t) => t.id !== fromTeam);
  const teamMembers = members.filter((m) => m.team_id === teamId);

  const save = async () => {
    if (!title.trim()) { setError('Give the task a title.'); return; }
    if (!teamId) { setError('Pick a team.'); return; }
    setBusy(true);
    try {
      await api.createTask({
        team_id: teamId, title: title.trim(), description: description.trim() || undefined,
        deadline: deadline ? fromLocalInput(deadline) : null, priority,
        assignees: mode === 'task' ? assignees : [],
        requested_by_team_id: mode === 'request' ? fromTeam : null,
      });
      toast('ok', mode === 'request' ? 'Request sent.' : 'Task created.', mode === 'request' ? 'The other team’s executives will accept or decline it.' : undefined);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'request' ? 'Request from another team' : 'New task'}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{mode === 'request' ? 'Send request' : 'Create'}</Button></>}>
      <div className="grid gap-s4">
        {canSendTaskRequests(me) && <Segmented label="Type" value={mode} onChange={(v) => { setMode(v); setTeamId(v === 'task' ? mine[0]?.id ?? '' : ''); }}
          options={[{ value: 'task', label: 'My team' }, { value: 'request', label: 'Other team' }]} />}
        {mode === 'request' && mine.length > 1 && (
          <Select label="From" value={fromTeam} onChange={(e) => setFromTeam(e.target.value)}>
            {mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
        <Select label={mode === 'request' ? 'Ask which team?' : 'Team'} value={teamId} onChange={(e) => { setTeamId(e.target.value); setAssignees([]); }}>
          {mode === 'request' && <option value="">Choose a team…</option>}
          {targetTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={error && !title.trim() ? error : null} />
        <TextArea label="Details (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <div className="grid gap-s4 sm:grid-cols-2">
          <TextInput label="Deadline (optional)" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </Select>
        </div>
        {mode === 'task' && teamMembers.length > 0 && (
          <fieldset className="grid gap-s2">
            <legend className="tx-label mb-s2">Assign to</legend>
            {teamMembers.map((m) => (
              <label key={m.user_id} className="tx-check">
                <input type="checkbox" checked={assignees.includes(m.user_id)}
                  onChange={(e) => setAssignees(e.target.checked ? [...assignees, m.user_id] : assignees.filter((x) => x !== m.user_id))} />
                <span>{m.name} <span className="text-ink-3">· {m.role}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {error && title.trim() && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
