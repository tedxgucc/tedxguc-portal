'use client';
// Divisions and teams (FR-3.2) and season rollover (FR-3.3), Chairman only.
import { CalendarClock, Pencil, Plus, Power } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, DivTag, Modal, Select, Skeleton, TextInput } from '@/components/ui';
import { adminApi, type Season } from '@/lib/api/admin';
import { fmtDate } from '@/lib/format';

type Edit = { kind: 'team' | 'division'; id: string; name: string } | { kind: 'new-team'; divisionId: string; name: string } | null;

export function StructureTab() {
  const { divisions, teams, members, reload } = usePortal();
  const toast = useToast();
  const [edit, setEdit] = useState<Edit>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.kind === 'team') await adminApi.renameTeam(edit.id, edit.name);
      else if (edit.kind === 'division') await adminApi.renameDivision(edit.id, edit.name);
      else if (edit.kind === 'new-team') await adminApi.addTeam(edit.divisionId, edit.name);
      toast('ok', edit.kind === 'new-team' ? 'Team added' : 'Name changed', 'Everyone sees the new name right away.');
      setEdit(null);
      reload();
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(false); }
  };
  const count = (teamId: string) => members.filter((m) => m.team_id === teamId).length;

  return (
    <div className="grid gap-s6">
      <p className="text-ink-2 max-w-[640px]">Rename divisions and teams, or add a team. Changes apply to this season; next season starts from a copy of this setup.</p>
      <div className="grid gap-s4 lg:grid-cols-2">
        {divisions.map((d) => {
          const curator = members.find((m) => m.role === 'curator' && m.division_id === d.id);
          return (
            <section key={d.id} className="tx-card grid gap-s3 content-start">
              <div className="flex items-start justify-between gap-s3">
                <div className="grid gap-s1 min-w-0">
                  <DivTag kind={d.kind}>{d.name}</DivTag>
                  <span className="caption tx-faint">Curator: {curator?.name ?? 'none yet'}</span>
                </div>
                <button type="button" className="tx-iconbtn" aria-label={`Rename ${d.name}`} onClick={() => setEdit({ kind: 'division', id: d.id, name: d.name })}><Pencil size={18} /></button>
              </div>
              <ul className="grid">
                {teams.filter((t) => t.division_id === d.id).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-s3 py-s2 border-t border-line">
                    <span className="min-w-0 truncate font-semibold">{t.name}</span>
                    <span className="flex items-center gap-s2 shrink-0">
                      <span className="caption tx-faint tx-num">{count(t.id)} people</span>
                      <button type="button" className="tx-iconbtn" aria-label={`Rename ${t.name}`} onClick={() => setEdit({ kind: 'team', id: t.id, name: t.name })}><Pencil size={16} /></button>
                    </span>
                  </li>
                ))}
              </ul>
              <div><Button variant="ghost" small onClick={() => setEdit({ kind: 'new-team', divisionId: d.id, name: '' })}><Plus size={16} aria-hidden="true" />Add team</Button></div>
            </section>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)}
        title={edit?.kind === 'new-team' ? `New team in ${divisions.find((d) => d.id === edit.divisionId)?.name ?? ''}` : edit?.kind === 'division' ? 'Rename division' : 'Rename team'}
        actions={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
        {edit && <TextInput label="Name" value={edit.name} autoFocus maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />}
      </Modal>
    </div>
  );
}

export function RolloverTab() {
  const { me, members } = usePortal();
  const toast = useToast();
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [year, setYear] = useState('');
  const [theme, setTheme] = useState('');
  const [chair, setChair] = useState(me.id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Season | null>(null);
  const [themeEdit, setThemeEdit] = useState<Season | null>(null);

  const load = useCallback(() => {
    adminApi.listSeasons().then((s) => {
      setSeasons(s);
      setYear(String(Math.max(...s.map((x) => x.year)) + 1));
    }).catch(() => setSeasons([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!seasons) return <Skeleton h={240} />;

  const active = seasons.find((s) => s.is_active);
  const upcoming = seasons.filter((s) => !s.is_active && (!active || s.year > active.year));

  const prepare = async () => {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2013 || y > 2100) { toast('bad', 'Check the year', 'Use a year like 2028.'); return; }
    setBusy(true);
    try {
      await adminApi.prepareSeason(y, theme, chair);
      toast('ok', `Season ${y} prepared`, 'Divisions, teams and settings were copied. Invite the new board, then switch.');
      setTheme('');
      load();
    } catch (e) {
      toast('bad', 'Couldn’t prepare the season', (e as Error).message);
    } finally { setBusy(false); }
  };
  const activate = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await adminApi.activateSeason(confirm.id);
      toast('ok', `Season ${confirm.year} is live`, 'This season’s members are now alumni. Balances carried over.');
      setConfirm(null);
      load();
    } catch (e) {
      toast('bad', 'Couldn’t switch seasons', (e as Error).message);
    } finally { setBusy(false); }
  };
  const saveTheme = async () => {
    if (!themeEdit) return;
    setBusy(true);
    try {
      await adminApi.updateSeasonTheme(themeEdit.id, themeEdit.theme ?? '');
      setThemeEdit(null);
      load();
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-s7 max-w-[860px]">
      <section className="grid gap-s3">
        <SectionHeading>Seasons</SectionHeading>
        <ul className="grid gap-s2">
          {seasons.map((s) => (
            <li key={s.id} className="tx-card flex flex-wrap items-center justify-between gap-s3">
              <div className="grid gap-s1 min-w-0">
                <span className="h3 tx-num">{s.year}{s.theme ? <span className="text-ink-2"> · {s.theme}</span> : null}</span>
                <span className="caption tx-faint">{s.is_active ? `Live since ${s.activated_at ? fmtDate(s.activated_at, { year: true }) : '—'}` : s.activated_at ? 'Past season' : 'Prepared, not live yet'}</span>
              </div>
              <div className="flex items-center gap-s2">
                {s.is_active ? <Chip kind="ok">Live</Chip> : !s.activated_at ? <Chip kind="pending">Next</Chip> : <Chip kind="soft">Alumni</Chip>}
                <button type="button" className="tx-iconbtn" aria-label={`Edit theme for ${s.year}`} onClick={() => setThemeEdit(s)}><Pencil size={16} /></button>
                {upcoming.includes(s) && <Button small onClick={() => setConfirm(s)}><Power size={16} aria-hidden="true" />Switch to {s.year}</Button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length === 0 && (
        <section className="grid gap-s4">
          <SectionHeading>Prepare next season</SectionHeading>
          <p className="text-ink-2">Copies this season’s divisions, teams and settings into a new season and names its Chairman. Nothing changes for members until you switch.</p>
          <div className="grid gap-s4 md:grid-cols-3">
            <TextInput label="Year" type="number" inputMode="numeric" min={2013} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
            <TextInput label="Theme (optional)" value={theme} maxLength={60} onChange={(e) => setTheme(e.target.value)} />
            <Select label="Next Chairman" value={chair} onChange={(e) => setChair(e.target.value)}>
              {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.user_id === me.id ? ' (you)' : ''}</option>)}
            </Select>
          </div>
          <div><Button loading={busy} onClick={prepare}><CalendarClock size={18} aria-hidden="true" />Prepare season {year}</Button></div>
        </section>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Switch to season ${confirm?.year ?? ''}?`}
        actions={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={activate}>Switch season</Button></>}>
        <ul className="grid gap-s2 list-disc pl-s5 text-ink-2">
          <li>Everyone in season {active?.year ?? 'now'} becomes an alumnus. They keep read access to their history.</li>
          <li>Account balances carry over to {confirm?.year}.</li>
          <li>Only the new Chairman and people invited to {confirm?.year} can act in the portal.</li>
          <li>This can’t be undone.</li>
        </ul>
      </Modal>

      <Modal open={!!themeEdit} onClose={() => setThemeEdit(null)} title={`Theme for ${themeEdit?.year ?? ''}`}
        actions={<><Button variant="secondary" onClick={() => setThemeEdit(null)}>Cancel</Button><Button loading={busy} onClick={saveTheme}>Save</Button></>}>
        {themeEdit && <TextInput label="Theme" value={themeEdit.theme ?? ''} maxLength={60} autoFocus onChange={(e) => setThemeEdit({ ...themeEdit, theme: e.target.value })} />}
      </Modal>
    </div>
  );
}
