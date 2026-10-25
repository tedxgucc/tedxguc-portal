'use client';
// Schedule a meeting (FR-7.1). Executives: their own team only. Curators:
// a team in their division or the whole division. Chairman: anything,
// including board meetings. OD Executives: club-wide workshops.
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Modal, Select, TextArea, TextInput } from '@/components/ui';
import { attendanceApi } from '@/lib/api/phase2';
import { fromLocalInput } from '@/lib/format';
import type { MeetingType } from '@/lib/types';
import { meetingTypeLabel, meetingTypeOne } from './AttendanceBits';
import { usePortal } from './PortalContext';

type Scope = { key: string; label: string; team_id: string | null; division_id: string | null };

export function NewMeetingModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { me, teams, divisions } = usePortal();
  const toast = useToast();
  const scopes: Scope[] = [];
  if (me.role === 'executive' && me.team_id) scopes.push({ key: `t-${me.team_id}`, label: me.team_name ?? 'My team', team_id: me.team_id, division_id: null });
  if (me.role === 'curator') {
    scopes.push({ key: `d-${me.division_id}`, label: `${me.division_name} (whole division)`, team_id: null, division_id: me.division_id });
    for (const t of teams.filter((x) => x.division_id === me.division_id)) scopes.push({ key: `t-${t.id}`, label: t.name, team_id: t.id, division_id: null });
  }
  if (me.role === 'chairman') {
    for (const d of divisions) scopes.push({ key: `d-${d.id}`, label: `${d.name} (division)`, team_id: null, division_id: d.id });
    for (const t of teams) scopes.push({ key: `t-${t.id}`, label: t.name, team_id: t.id, division_id: null });
  }
  const clubWide = me.role === 'chairman' || me.role === 'curator' || (me.role === 'executive' && me.division_kind === 'org_development');
  if (clubWide) scopes.unshift({ key: 'club', label: 'Whole club', team_id: null, division_id: null });

  const types: MeetingType[] = me.role === 'chairman' ? ['team_meeting', 'board_meeting', 'workshop', 'general_assembly', 'session']
    : ['team_meeting', 'workshop', 'session', ...(clubWide ? ['general_assembly' as MeetingType] : [])];

  const [scope, setScope] = useState(scopes.find((x) => x.team_id)?.key ?? scopes[0]?.key ?? '');
  const [type, setType] = useState<MeetingType>('team_meeting');
  const [title, setTitle] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [slot, setSlot] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (type === 'board_meeting') setScope('club'); }, [type]);

  const save = async () => {
    const sc = scopes.find((x) => x.key === scope);
    if (!sc || !title.trim() || !starts) { setError('Add a title and a start time.'); return; }
    setBusy(true);
    try {
      await attendanceApi.createMeeting({
        type, title: title.trim(), team_id: sc.team_id, division_id: sc.division_id,
        starts_at: fromLocalInput(starts), ends_at: ends ? fromLocalInput(ends) : null,
        slot: slot.trim() || undefined, location: location.trim() || undefined, agenda: agenda.trim() || undefined,
      });
      toast('ok', 'Meeting scheduled.', 'Everyone expected gets a notification and sees it on the calendar.');
      setTitle(''); setStarts(''); setEnds(''); setSlot(''); setLocation(''); setAgenda(''); setError(null);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule a meeting"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Schedule</Button></>}>
      <div className="grid gap-s4">
        <div className="grid gap-s4 sm:grid-cols-2">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
            {types.map((t) => <option key={t} value={t}>{meetingTypeOne[t]}</option>)}
          </Select>
          <Select label="Who’s expected" value={scope} onChange={(e) => setScope(e.target.value)} disabled={type === 'board_meeting' || scopes.length === 1}>
            {scopes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </div>
        <p className="text-caption text-ink-3 -mt-s2">{type === 'board_meeting' ? 'Board meetings expect every Executive and Curator.' : 'Associates in that scope are expected and marked.'}</p>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Media & Design weekly" />
        <div className="grid gap-s4 sm:grid-cols-2">
          <TextInput label="Starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          <TextInput label="Ends (optional)" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
          <TextInput label="Slot (optional)" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Slot 3" />
          <TextInput label="Room or link (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <TextArea label="Agenda (optional)" value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
