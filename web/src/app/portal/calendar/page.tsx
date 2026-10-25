'use client';
// Club calendar (FR-15): who can add what follows FR-15.2–15.5.
// Associates only view; Executives add for their team; Curators and the
// Chairman add club-wide or public entries too.
import { Link2, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { CalendarView } from '@/components/CalendarView';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Modal, Segmented, Select, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { fromLocalInput } from '@/lib/format';
import { canManageTeam, canPostClubWide, manageableTeams } from '@/lib/roles';
import type { CalendarItem, CalendarVisibility } from '@/lib/types';

export default function PortalCalendar() {
  const { me, teams, divisions } = usePortal();
  const toast = useToast();
  const [teamFilter, setTeamFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const myTeams = manageableTeams(me, teams);
  const canAdd = myTeams.length > 0 || canPostClubWide(me);

  const load = useCallback((from: string, to: string) => api.calendarFeed(from, to, teamFilter || null), [teamFilter]);
  const canDelete = (i: CalendarItem) => i.source === 'entry'
    && (i.visibility === 'team' ? canManageTeam(me, teams.find((t) => t.id === i.team_id)) : me.role === 'chairman' || me.role === 'curator');

  return (
    <>
      <PageTitle label="Calendar" title="Calendar">
        <div className="flex gap-s2">
          <FeedLinkButton />
          {canAdd && <Button onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add</Button>}
        </div>
      </PageTitle>
      {teams.length > 1 && (
        <div className="w-full sm:w-[260px] mb-s5">
          <Select label="Show" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">Everything I can see</option>
            {teams.filter((t) => me.role === 'chairman' || me.role === 'curator' ? true : t.id === me.team_id).map((t) => <option key={t.id} value={t.id}>{t.name} only</option>)}
          </Select>
        </div>
      )}
      <CalendarView load={load} teams={teams} divisions={divisions} reloadKey={reloadKey} canDelete={canDelete}
        onDelete={async (i) => {
          try { await api.deleteCalendarEntry(i.id); toast('ok', 'Entry deleted.'); } catch (e) { toast('bad', "That didn't delete.", (e as Error).message); }
        }} />
      <AddEntryModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setReloadKey((k) => k + 1); }} />
    </>
  );
}

function AddEntryModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { me, teams } = usePortal();
  const toast = useToast();
  const myTeams = manageableTeams(me, teams);
  const wide = canPostClubWide(me);
  const [visibility, setVisibility] = useState<CalendarVisibility>(myTeams.length ? 'team' : 'club');
  const [teamId, setTeamId] = useState(myTeams[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim() || !starts) { setError('Add a title and a start time.'); return; }
    if (ends && ends < starts) { setError('The end is before the start.'); return; }
    setBusy(true);
    try {
      await api.createCalendarEntry({
        visibility, team_id: visibility === 'team' ? teamId : null, title: title.trim(), description: description.trim() || undefined,
        starts_at: fromLocalInput(starts), ends_at: ends ? fromLocalInput(ends) : null, all_day: allDay,
        location: location.trim() || undefined, online_url: url.trim() || undefined,
      });
      toast('ok', 'Added to the calendar.');
      setTitle(''); setStarts(''); setEnds(''); setLocation(''); setUrl(''); setDescription(''); setError(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const options = [
    ...(myTeams.length ? [{ value: 'team' as const, label: 'Team' }] : []),
    ...(wide ? [{ value: 'club' as const, label: 'Club-wide' }, { value: 'public' as const, label: 'Public' }] : []),
  ];
  return (
    <Modal open={open} onClose={onClose} title="Add to the calendar"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add</Button></>}>
      <div className="grid gap-s4">
        {options.length > 1 && <Segmented label="Who sees it" value={visibility} onChange={setVisibility} options={options} />}
        <p className="text-caption text-ink-3 -mt-s2">
          {visibility === 'team' ? 'Only that team, its curator and the chairman see it.' : visibility === 'club' ? 'Every member sees it.' : 'Also shown on the public calendar, no login needed.'}
        </p>
        {visibility === 'team' && myTeams.length > 1 && (
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-s4 sm:grid-cols-2">
          <TextInput label="Starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          <TextInput label="Ends (optional)" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
        </div>
        <Check2 label="All day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <TextInput label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <TextInput label="Online link (optional)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        <TextArea label="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

// Personal .ics link for Google / Apple Calendar (FR-15.9).
function FeedLinkButton() {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const make = async () => {
    try {
      const token = await api.rotateCalendarToken();
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? window.location.origin;
      setLink(`${base}/functions/v1/calendar-ics?token=${token}`);
      setOpen(true);
    } catch (e) {
      toast('bad', "Couldn't make the link.", (e as Error).message);
    }
  };
  return (
    <>
      <Button variant="secondary" onClick={make}><Link2 aria-hidden="true" />Sync</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add to your phone’s calendar"
        actions={<><Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={() => { navigator.clipboard?.writeText(link ?? ''); toast('ok', 'Link copied.'); }}>Copy link</Button></>}>
        <p className="text-ink-2 mb-s3">In Google Calendar choose “From URL”; on iPhone go to Settings → Calendar → Accounts → Add subscribed calendar. Keep this link private: anyone with it sees your calendar.</p>
        <p className="code break-all bg-surface-2 p-s3">{link}</p>
        <p className="text-caption text-ink-3 mt-s2">Making a new link turns the old one off.</p>
      </Modal>
    </>
  );
}
