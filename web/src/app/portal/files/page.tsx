'use client';
// Files & handover library (FR-9), by stakeholder:
//   Everyone   → reads the club library (brand kit, templates) and their own team's/division's files
//   Executive  → uploads to their own team; marks their handover file
//   Curator    → uploads to their division, its teams, the club library and board folder
//   Chairman   → everything, plus the handover check before rollover (FR-9.4)
// Associates read only. Board files are hidden from Associates.
import { Download, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextInput } from '@/components/ui';
import { filesApi } from '@/lib/api/phase2b';
import { fmtShortDate } from '@/lib/format';
import { canManageTeam } from '@/lib/roles';
import type { FileScope, HandoverRow, LibFile, Me, Team } from '@/lib/types';

type Tab = 'library' | 'handover';

const scopeLabel: Record<FileScope, string> = { club: 'Club library', division: 'Division', team: 'Team', board: 'Board only' };
const size = (b: number | null) => (b === null ? '' : b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

function canWrite(me: Me, teams: Team[], f: Pick<LibFile, 'scope' | 'team_id' | 'division_id'>) {
  if (f.scope === 'club' || f.scope === 'board') return me.role === 'chairman' || me.role === 'curator';
  if (f.scope === 'division') return me.role === 'chairman' || (me.role === 'curator' && me.division_id === f.division_id);
  return canManageTeam(me, teams.find((t) => t.id === f.team_id));
}

export default function FilesPage() {
  const { me } = usePortal();
  const [tab, setTab] = useState<Tab>('library');
  return (
    <>
      <PageTitle label="Files" title={tab === 'library' ? 'Library' : 'Handover'} />
      {me.role === 'chairman' && <div className="mb-s5 max-w-[360px]"><Segmented label="Files view" value={tab} onChange={setTab} options={[{ value: 'library', label: 'Library' }, { value: 'handover', label: 'Handover check' }]} /></div>}
      {tab === 'library' ? <Library /> : <Handover />}
    </>
  );
}

function Library() {
  const { me, teams, divisions, team, memberName } = usePortal();
  const toast = useToast();
  const [files, setFiles] = useState<LibFile[] | null>(null);
  const [scope, setScope] = useState<FileScope | 'all'>('all');
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const load = useCallback(() => filesApi.listFiles().then(setFiles).catch(() => setFiles([])), []);
  useEffect(() => { load(); }, [load]);

  const where = (f: LibFile) => f.scope === 'team' ? team(f.team_id)?.name ?? 'Team' : f.scope === 'division' ? divisions.find((d) => d.id === f.division_id)?.name ?? 'Division' : scopeLabel[f.scope];
  const shown = (files ?? []).filter((f) => (scope === 'all' || f.scope === scope) && (!q.trim() || `${f.name} ${f.folder}`.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = useMemo(() => {
    const m = new Map<string, LibFile[]>();
    for (const f of shown) { const k = `${where(f)} / ${f.folder}`; m.set(k, [...(m.get(k) ?? []), f]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const canUpload = me.role !== 'associate' && me.role !== null;
  const scopes: (FileScope | 'all')[] = ['all', 'club', ...(me.role !== 'associate' ? (['board'] as FileScope[]) : []), 'division', 'team'];

  const open = async (f: LibFile) => {
    const url = await filesApi.open(f);
    if (url) window.open(url, '_blank', 'noopener');
    else toast('warn', 'Files open in live mode.', 'Demo mode has no real files to download.');
  };

  return (
    <div className="grid gap-s4">
      <div className="flex flex-wrap items-end gap-s3">
        {canUpload && <Button onClick={() => setUploading(true)}><Upload aria-hidden="true" />Upload</Button>}
        <div className="w-full sm:w-[260px]"><TextInput label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File or folder name" /></div>
        <div className="w-full sm:w-[200px]">
          <Select label="Where" value={scope} onChange={(e) => setScope(e.target.value as FileScope | 'all')}>
            {scopes.map((s) => <option key={s} value={s}>{s === 'all' ? 'Everything I can see' : s === 'team' ? (me.role === 'executive' || me.role === 'associate' ? 'My team' : 'Teams') : s === 'division' ? 'Division' : scopeLabel[s]}</option>)}
          </Select>
        </div>
      </div>
      {!canUpload && <p className="text-caption text-ink-3">You can read and download. Your executive adds your team’s files.</p>}

      {files === null ? <Skeleton h={240} /> : groups.length === 0 ? <EmptyState title="Nothing here yet.">{canUpload ? 'Upload templates, plans and the brand kit so nobody starts from zero.' : 'Files your team shares show up here.'}</EmptyState> : (
        <div className="grid gap-s5">
          {groups.map(([k, list]) => (
            <section key={k} className="grid gap-s2" aria-label={k}>
              <h2 className="tx-label flex items-center gap-s1"><FolderOpen size={14} aria-hidden="true" />{k} <b>({String(list.length).padStart(2, '0')})</b></h2>
              <ul className="grid gap-s1">
                {list.map((f) => {
                  const writable = canWrite(me, teams, f);
                  return (
                    <li key={f.id} className="tx-card grid grid-cols-[auto_minmax(0,1fr)_auto] gap-s3 items-center" style={{ padding: '10px 12px' }}>
                      <span className="tx-file__thumb" style={{ width: 40, height: 40 }}><FileText aria-hidden="true" /></span>
                      <button className="grid grid-cols-1 min-w-0 text-left bg-transparent border-0 cursor-pointer p-0 text-ink" onClick={() => open(f)}>
                        <span className="font-semibold truncate">{f.name}</span>
                        <span className="text-caption text-ink-3 truncate">{size(f.size_bytes)} · {memberName(f.uploaded_by)} · {fmtShortDate(f.created_at)}</span>
                      </button>
                      <span className="flex items-center gap-s1">
                        {f.is_handover && <Chip kind="ok">Handover</Chip>}
                        <button className="tx-iconbtn" aria-label={`Download ${f.name}`} onClick={() => open(f)}><Download size={18} /></button>
                        {writable && <button className="tx-iconbtn" aria-label={`Delete ${f.name}`} onClick={async () => { try { await filesApi.remove(f); toast('ok', 'File deleted.'); load(); } catch (e) { toast('bad', 'Couldn’t delete.', (e as Error).message); } }}><Trash2 size={18} /></button>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {uploading && <UploadModal folders={[...new Set((files ?? []).map((f) => f.folder))]} onClose={() => setUploading(false)} onDone={() => { setUploading(false); load(); }} />}
    </div>
  );
}

function UploadModal({ folders, onClose, onDone }: { folders: string[]; onClose: () => void; onDone: () => void }) {
  const { me, teams, divisions } = usePortal();
  const toast = useToast();
  // Where this person may upload.
  const targets: { key: string; label: string; scope: FileScope; team_id: string | null; division_id: string | null }[] = [];
  if (me.role === 'executive' && me.team_id) targets.push({ key: `t-${me.team_id}`, label: `${me.team_name} (my team)`, scope: 'team', team_id: me.team_id, division_id: null });
  if (me.role === 'curator' || me.role === 'chairman') {
    targets.push({ key: 'club', label: 'Club library (everyone)', scope: 'club', team_id: null, division_id: null }, { key: 'board', label: 'Board only', scope: 'board', team_id: null, division_id: null });
    for (const d of divisions.filter((x) => me.role === 'chairman' || x.id === me.division_id)) targets.push({ key: `d-${d.id}`, label: `${d.name} (division)`, scope: 'division', team_id: null, division_id: d.id });
    for (const t of teams.filter((x) => me.role === 'chairman' || x.division_id === me.division_id)) targets.push({ key: `t-${t.id}`, label: t.name, scope: 'team', team_id: t.id, division_id: null });
  }
  const [target, setTarget] = useState(targets[0]?.key ?? '');
  const [folder, setFolder] = useState(folders[0] ?? 'General');
  const [newFolder, setNewFolder] = useState('');
  const [handover, setHandover] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const save = async () => {
    const t = targets.find((x) => x.key === target);
    const fld = (folder === '__new' ? newFolder : folder).trim() || 'General';
    if (!t || !file) { toast('bad', 'Pick a file and where it goes.'); return; }
    if (file.size > 50 * 1024 * 1024) { toast('bad', 'Files must be under 50 MB.'); return; }
    setBusy(true);
    try { await filesApi.upload({ scope: t.scope, team_id: t.team_id, division_id: t.division_id, folder: handover ? 'Handover' : fld, file, is_handover: handover }); toast('ok', 'Uploaded.', `${file.name} is in ${t.label}.`); onDone(); }
    catch (e) { toast('bad', 'That didn’t upload.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Upload a file"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} disabled={!file}>Upload</Button></>}>
      <div className="grid gap-s4">
        <input ref={ref} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="tx-file"><div className="tx-file__thumb"><FileText aria-hidden="true" /></div><div className="min-w-0"><div className="font-semibold truncate text-body-sm">{file.name}</div><div className="text-caption text-ink-3">{size(file.size)}</div></div>
            <button type="button" className="tx-link text-caption bg-transparent border-0 cursor-pointer" onClick={() => setFile(null)}>Change</button></div>
        ) : (
          <button type="button" className="tx-upload w-full" onClick={() => ref.current?.click()}><Upload aria-hidden="true" /><span className="tx-upload__t">Choose a file</span><span className="tx-upload__d">Up to 50 MB</span></button>
        )}
        <Select label="Who can see it" value={target} onChange={(e) => setTarget(e.target.value)}>{targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
        {!handover && <>
          <Select label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
            {[...new Set(['General', 'Brand kit', 'Templates', ...folders])].map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="__new">New folder…</option>
          </Select>
          {folder === '__new' && <TextInput label="Folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />}
        </>}
        {(me.role === 'executive' || me.role === 'curator') && (
          <Check2 label="This is my handover file for the next board" checked={handover} onChange={(e) => setHandover(e.target.checked)} />
        )}
      </div>
    </Modal>
  );
}

// FR-9.4: every Executive and Curator, and whether their handover is in.
function Handover() {
  const [rows, setRows] = useState<HandoverRow[] | null>(null);
  useEffect(() => { filesApi.handoverStatus().then(setRows).catch(() => setRows([])); }, []);
  const missing = (rows ?? []).filter((r) => !r.handover_files).length;
  return (
    <div className="grid gap-s4">
      <div className="grid grid-cols-2 gap-s2 sm:w-[480px]">
        <div className="tx-card tx-kpi"><span className="tx-label">Handed over</span><span className="stat tx-num">{(rows ?? []).length - missing}</span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">Missing</span><span className={`stat tx-num ${missing ? 'text-bad' : ''}`}>{missing}</span><span className="caption tx-faint">Needed before rollover</span></div>
      </div>
      <SectionHeading as="h3">Board handovers</SectionHeading>
      {rows === null ? <Skeleton h={240} /> : (
        <table className="tx-table">
          <thead><tr><th>Member</th><th className="hidden sm:table-cell">Role</th><th>Handover</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td className="tx-strong">{r.name}<div className="text-caption text-ink-3 font-normal">{r.team ?? r.division}</div></td>
                <td className="hidden sm:table-cell">{r.role === 'curator' ? 'Curator' : 'Executive'}</td>
                <td>{r.handover_files ? <Chip kind="ok">{r.handover_files} file{r.handover_files > 1 ? 's' : ''}</Chip> : <Chip kind="bad">Missing</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-caption text-ink-3">Executives and Curators upload their handover from Library → Upload → “This is my handover file”.</p>
    </div>
  );
}

