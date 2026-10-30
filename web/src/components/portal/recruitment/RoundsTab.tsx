'use client';
// Recruitment rounds (FR-4.1): the Chairman opens and closes them.
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Segmented, Skeleton, TextInput } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { fmtDate, fromLocalInput, toLocalInput } from '@/lib/format';
import type { Cycle, CycleKind } from '@/lib/types';

const state = (c: Cycle) => {
  const now = Date.now();
  if (now < new Date(c.opens_at).getTime()) return <Chip kind="soft">Opens {fmtDate(c.opens_at)}</Chip>;
  if (now > new Date(c.closes_at).getTime()) return <Chip kind="void">Closed</Chip>;
  return <Chip kind="ok">Open</Chip>;
};

export function RoundsTab() {
  const toast = useToast();
  const [deleting, setDeleting] = useState<Cycle | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [editing, setEditing] = useState<Cycle | 'new' | null>(null);
  const load = useCallback(() => recruitmentApi.listCycles().then(setCycles).catch(() => setCycles([])), []);
  useEffect(() => { load(); }, [load]);
  const remove = async () => {
    if (!deleting || removing) return;
    setRemoving(true); setDeleteError(null);
    try {
      await recruitmentApi.deleteCycle(deleting.id);
      setCycles(rows => rows?.filter(c => c.id !== deleting.id) ?? null);
      setDeleting(null); toast('ok', 'Round deleted.');
    } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Could not delete this round. Please try again.'); }
    finally { setRemoving(false); }
  };
  return (
    <div className="grid gap-s4">
      <Button className="justify-self-start" onClick={() => setEditing('new')}><Plus aria-hidden="true" />New round</Button>
      {cycles === null ? <Skeleton h={160} /> : cycles.length === 0 ? <EmptyState title="No rounds yet." /> : (
        <ul className="grid gap-s2">
          {cycles.map((c) => (
            <li key={c.id} className="tx-card grid grid-cols-[minmax(0,1fr)_auto] gap-s3 items-center" style={{ padding: '12px 16px' }}>
              <span className="grid grid-cols-1 min-w-0">
                <span className="font-semibold truncate">{c.name}</span>
                <span className="text-caption text-ink-3">{c.kind === 'board' ? 'Board' : 'Associates'} · {fmtDate(c.opens_at)} – {fmtDate(c.closes_at)}{c.rejections_released_at ? ' · rejections sent' : ''}</span>
              </span>
              <span className="flex items-center gap-s2">{state(c)}<button className="tx-iconbtn" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil size={18} /></button><Button small variant="danger" aria-label={'Delete ' + c.name} onClick={() => { setDeleteError(null); setDeleting(c); }}><Trash2 size={16} aria-hidden="true" />Delete</Button></span>
            </li>
          ))}
        </ul>
      )}
      {deleting && <Modal open title={'Delete ' + deleting.name + '?'} onClose={() => { if (!removing) setDeleting(null); }} actions={<><Button variant="secondary" disabled={removing} onClick={() => setDeleting(null)}>Keep round</Button><Button variant="danger" loading={removing} onClick={remove}>Delete round</Button></>}>
        <p>This permanently deletes the round and ALL its applicants, answers, interview scores, referrals, board plans, roles and interview availability. This cannot be undone. Existing member accounts are kept.</p>
        {deleteError && <p className="text-bad mt-s3" role="alert">{deleteError}</p>}
      </Modal>}
      {editing && <RoundModal cycle={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RoundModal({ cycle, onClose, onSaved }: { cycle: Cycle | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(cycle?.name ?? '');
  const [kind, setKind] = useState<CycleKind>(cycle?.kind ?? 'associates');
  const [opens, setOpens] = useState(cycle ? toLocalInput(cycle.opens_at) : '');
  const [closes, setCloses] = useState(cycle ? toLocalInput(cycle.closes_at) : '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || !opens || !closes || closes <= opens) { toast('bad', 'Add a name, and a close date after the open date.'); return; }
    setBusy(true);
    try { await recruitmentApi.saveCycle({ id: cycle?.id, name: name.trim(), kind, opens_at: fromLocalInput(opens), closes_at: fromLocalInput(closes) }); toast('ok', 'Round saved.'); onSaved(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={cycle ? `Edit ${cycle.name}` : 'New recruitment round'}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Associates · Fall 2027" />
        <div className="grid gap-s4 sm:grid-cols-2">
          <TextInput label="Opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
          <TextInput label="Closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
        </div>
        <p className="text-caption text-ink-3">After opening, Curators add their teams’ roles and questions in “Roles”.</p>
      </div>
    </Modal>
  );
}
