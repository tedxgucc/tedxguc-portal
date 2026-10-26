'use client';
// Open roles and their questions (FR-4.1, 4.2). Curators edit their own
// division's teams; the Chairman edits any.
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { recruitmentApi, type PositionFill } from '@/lib/api/phase2b';
import type { Cycle, Position, Question } from '@/lib/types';

export function PositionsTab() {
  const { me, teams, team } = usePortal();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [editing, setEditing] = useState<{ teamId: string; position: Position | null } | null>(null);
  const [fill, setFill] = useState<PositionFill[]>([]);
  useEffect(() => { if (cycleId) recruitmentApi.positionFill(cycleId).then(setFill).catch(() => setFill([])); }, [cycleId, positions]);
  const load = useCallback(() => {
    recruitmentApi.listCycles().then((c) => { setCycles(c); setCycleId((cur) => cur || c.find((x) => new Date(x.closes_at).getTime() > Date.now())?.id || c[0]?.id || ''); }).catch(() => {});
    recruitmentApi.listPositions().then(setPositions).catch(() => setPositions([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  const myTeams = me.role === 'chairman' ? teams : teams.filter((t) => t.division_id === me.division_id);

  return (
    <div className="grid gap-s4">
      <div className="w-full sm:w-[320px]">
        <Select label="Round" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}{c.kind === 'board' ? ' (board)' : ''}</option>)}</Select>
      </div>
      {positions === null ? <Skeleton h={200} /> : myTeams.length === 0 ? <EmptyState title="No teams to manage." /> : (
        <ul className="grid gap-s2 md:grid-cols-2">
          {myTeams.map((t) => {
            const p = positions.find((x) => x.cycle_id === cycleId && x.team_id === t.id) ?? null;
            return (
              <li key={t.id} className="tx-card grid gap-s2 content-start">
                <div className="flex items-center justify-between gap-s2">
                  <span className="font-semibold">{t.name}</span>
                  {p ? (!p.is_open ? <Chip kind="void">Closed</Chip> : fill.find((x) => x.team_id === t.id)?.is_full ? <Chip kind="pending">Full</Chip> : <Chip kind="ok">Recruiting</Chip>) : <Chip kind="soft">Not recruiting</Chip>}
                </div>
                {p && <p className="text-body-sm text-ink-2">{`${fill.find((x) => x.team_id === t.id)?.applicants ?? 0}${p.seats ? ` / ${p.seats}` : ''} first-choice applicants · `}{p.questions.length} question{p.questions.length === 1 ? '' : 's'}{p.description ? ` · ${p.description}` : ''}</p>}
                <Button small variant="secondary" className="justify-self-start" onClick={() => setEditing({ teamId: t.id, position: p })}>
                  {p ? <><Pencil aria-hidden="true" />Edit role</> : <><Plus aria-hidden="true" />Open a role</>}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <PositionModal cycleId={cycleId} teamName={team(editing.teamId)?.name ?? ''} teamId={editing.teamId} position={editing.position} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PositionModal({ cycleId, teamId, teamName, position, onClose, onSaved }: { cycleId: string; teamId: string; teamName: string; position: Position | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [seats, setSeats] = useState(position?.seats?.toString() ?? '');
  const [description, setDescription] = useState(position?.description ?? '');
  const [isOpen, setIsOpen] = useState(position?.is_open ?? true);
  const [questions, setQuestions] = useState<Question[]>(position?.questions ?? []);
  const [busy, setBusy] = useState(false);
  const setQ = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const save = async () => {
    if (questions.some((q) => !q.label.trim())) { toast('bad', 'Every question needs a label.'); return; }
    setBusy(true);
    try {
      await recruitmentApi.savePosition({ id: position?.id, cycle_id: cycleId, team_id: teamId, seats: seats ? Number(seats) : null, description: description.trim() || null, questions: questions.map((q) => ({ ...q, label: q.label.trim() })), is_open: isOpen });
      toast('ok', 'Role saved.', isOpen ? 'It shows on the Join page now.' : 'Closed: hidden from the Join page.');
      onSaved();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${teamName}: open role`}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        <div className="grid gap-s4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <TextInput label="Max applicants (first choice)" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} help="Empty = no limit. When it’s reached, the team shows Full and can only be picked as a second preference." />
          <div className="sm:pt-s6"><Check2 label="Recruiting now (shows on the Join page)" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} /></div>
        </div>
        <TextArea label="What the team does" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <fieldset className="grid gap-s3">
          <legend className="tx-label mb-s2">Questions for applicants</legend>
          {questions.map((q, i) => (
            <div key={q.id} className="tx-card tx-card--outline grid gap-s2" style={{ padding: 12 }}>
              <TextInput label={`Question ${i + 1}`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} />
              <div className="flex flex-wrap items-center gap-s3">
                <select className="tx-select" style={{ width: 'auto', minHeight: 40 }} value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value as Question['kind'] })} aria-label="Answer type">
                  <option value="textarea">Paragraph</option><option value="text">Short answer</option><option value="url">Link</option>
                </select>
                <Check2 label="Required" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />
                <button type="button" className="tx-iconbtn ml-auto" aria-label="Remove question" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
          <Button type="button" small variant="ghost" className="justify-self-start" onClick={() => setQuestions((qs) => [...qs, { id: `q-${Math.random().toString(36).slice(2, 8)}`, label: '', kind: 'textarea', required: true }])}>
            <Plus aria-hidden="true" />Add question
          </Button>
        </fieldset>
      </div>
    </Modal>
  );
}
