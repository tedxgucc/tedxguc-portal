'use client';
// Tasks (FR-6): board by status, filter by team, task sheet, new task and
// cross-team requests. The database enforces who may move what.
import { Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { KanbanCard } from '@/components/portal/KanbanCard';
import { NewTaskModal } from '@/components/portal/NewTaskModal';
import { usePortal } from '@/components/portal/PortalContext';
import { TaskSheet } from '@/components/portal/TaskSheet';
import { Button, Check2, EmptyState, Segmented, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { canManageTeam, manageableTeams } from '@/lib/roles';
import type { Task, TaskStatus } from '@/lib/types';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'requested', label: 'Requests' },
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'in_review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

function TasksInner() {
  const { me, teams } = usePortal();
  const router = useRouter();
  const params = useSearchParams();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [teamFilter, setTeamFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(me.role === 'associate');
  const [mobileCol, setMobileCol] = useState<TaskStatus>('todo');
  const [creating, setCreating] = useState(false);
  const openId = params.get('task');

  const load = useCallback(() => api.listTasks().then(setTasks).catch(() => setTasks([])), []);
  useEffect(() => { load(); }, [load]);

  const visibleTeams = useMemo(() => {
    const ids = new Set((tasks ?? []).map((t) => t.team_id));
    return teams.filter((t) => ids.has(t.id));
  }, [tasks, teams]);

  const filtered = (tasks ?? []).filter((t) => (!teamFilter || t.team_id === teamFilter) && (!onlyMine || t.assignees.includes(me.id) || t.created_by === me.id));
  const columns = COLUMNS.filter((c) => c.status !== 'requested' || filtered.some((t) => t.status === 'requested'));
  const byStatus = (s: TaskStatus) => filtered.filter((t) => t.status === s);
  const canCreate = manageableTeams(me, teams).length > 0;
  const openTask = (t: Task) => router.push(`/portal/tasks?task=${t.id}`, { scroll: false });
  const close = () => router.push('/portal/tasks', { scroll: false });
  const current = tasks?.find((t) => t.id === openId) ?? null;

  return (
    <>
      <PageTitle label="Tasks" count={filtered.filter((t) => t.status !== 'done').length} title="Tasks">
        {canCreate && <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />New task</Button>}
      </PageTitle>

      <div className="flex flex-wrap items-end gap-s4 mb-s5">
        {visibleTeams.length > 1 && (
          <div className="w-full sm:w-[260px]">
            <Select label="Team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">All my teams</option>
              {visibleTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
        )}
        {me.role !== 'associate' && <div className="pb-s3"><Check2 label="Only mine" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /></div>}
      </div>

      {tasks === null && <Skeleton h={360} />}
      {tasks && filtered.length === 0 && (
        <EmptyState title="No tasks. Suspicious." action={canCreate ? <Button variant="secondary" onClick={() => setCreating(true)}>Add the first task</Button> : undefined}>
          {me.role === 'associate' ? 'When your executive assigns you something, it lands here first.' : 'Create a task and assign it to your team.'}
        </EmptyState>
      )}

      {tasks && filtered.length > 0 && (
        <>
          {/* Phones: one column at a time. */}
          <div className="md:hidden grid gap-s3">
            <div className="overflow-x-auto -mx-s4 px-s4">
              <div className="min-w-[420px]">
                <Segmented label="Column" value={mobileCol} onChange={setMobileCol}
                  options={columns.map((c) => ({ value: c.status, label: `${c.label} ${byStatus(c.status).length}` }))} />
              </div>
            </div>
            <div className="grid gap-s2">
              {byStatus(mobileCol).map((t) => <KanbanCard key={t.id} task={t} onOpen={openTask} />)}
              {byStatus(mobileCol).length === 0 && <p className="text-ink-3 text-body-sm py-s5 text-center">Nothing here.</p>}
            </div>
          </div>
          {/* Tablet and up: the board. */}
          <div className="hidden md:grid tx-board">
            {columns.map((c) => (
              <section key={c.status} className="tx-col" aria-label={c.label}>
                <div className="tx-col__head"><span className="tx-label">{c.label}</span><span className="caption tx-faint">{byStatus(c.status).length}</span></div>
                {byStatus(c.status).map((t) => <KanbanCard key={t.id} task={t} onOpen={openTask} />)}
              </section>
            ))}
          </div>
        </>
      )}

      {current && <TaskSheet task={current} canManage={canManageTeam(me, teams.find((t) => t.id === current.team_id))} onClose={close} onChanged={load} />}
      <NewTaskModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />
    </>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<Skeleton h={360} />}><TasksInner /></Suspense>;
}
