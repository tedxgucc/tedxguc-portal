'use client';
// Announcements (FR-8.1): Chairman → anyone; Curator → own division or one
// of its teams; Executive → own team. Read confirmations when asked.
import { Check, Pin, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { Billboard } from '@/components/portal/Billboard';
import { PhotoPicker } from '@/components/portal/PhotoPicker';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtRelative } from '@/lib/format';
import { canManageEvents, roleLabel } from '@/lib/roles';
import type { Announcement, AudienceType, Role } from '@/lib/types';

export default function NewsPage() {
  const { me, memberName, team, divisions } = usePortal();
  const toast = useToast();
  const [list, setList] = useState<Announcement[] | null>(null);
  const [writing, setWriting] = useState(false);
  const load = useCallback(() => api.listAnnouncements().then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  const canPost = me.role === 'chairman' || me.role === 'curator' || me.role === 'executive';

  const audienceText = (a: Announcement) => {
    if (a.audience_type === 'all') return 'Everyone';
    if (a.audience_type === 'team') return team(a.team_id)?.name ?? 'A team';
    if (a.audience_type === 'division') return divisions.find((d) => d.id === a.division_id)?.name ?? 'A division';
    return a.audience_role ? `All ${roleLabel[a.audience_role].toLowerCase()}s` : 'A role';
  };

  const confirm = async (a: Announcement) => {
    await api.confirmRead(a.id).catch(() => {});
    toast('ok', 'Thanks, noted.');
    load();
  };

  return (
    <>
      <PageTitle label="Announcements" count={list?.length} title="News">
        {canPost && <Button onClick={() => setWriting(true)}><Plus aria-hidden="true" />Post</Button>}
      </PageTitle>
      {list && <Billboard items={list} />}
      {list === null && <Skeleton h={240} />}
      {list?.length === 0 && <EmptyState title="All quiet.">Announcements from your team and the board show up here.</EmptyState>}
      <ul className="grid gap-s2">
        {list?.map((a) => (
          <li key={a.id}>
            <article className="tx-card grid gap-s3" style={a.pinned ? { boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}>
              <header className="flex items-center gap-s3">
                <Avatar name={memberName(a.author_id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{memberName(a.author_id)}</div>
                  <div className="text-caption text-ink-3">To {audienceText(a)} · {fmtRelative(a.created_at)}</div>
                </div>
                {a.pinned && <span className="text-caption text-ink-2 flex items-center gap-s1"><Pin size={14} aria-hidden="true" />Pinned</span>}
              </header>
              <h2 className="h4">{a.title}</h2>
              {a.image_url && <img src={a.image_url} alt="" className="w-full max-h-[360px] object-cover" />} {/* eslint-disable-line @next/next/no-img-element */}
              <p className="text-ink-2 whitespace-pre-line">{a.body}</p>
              {a.needs_confirmation && (
                a.read_by_me
                  ? <Chip kind="ok">Confirmed</Chip>
                  : a.author_id !== me.id && <Button small variant="secondary" className="justify-self-start" onClick={() => confirm(a)}><Check aria-hidden="true" />I’ve read this</Button>
              )}
            </article>
          </li>
        ))}
      </ul>
      {canPost && <Compose open={writing} onClose={() => setWriting(false)} onPosted={() => { setWriting(false); load(); }} />}
    </>
  );
}

function Compose({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const { me, teams, divisions } = usePortal();
  const toast = useToast();
  // Audiences this role may post to (the database checks again).
  const choices: { key: string; label: string; type: AudienceType; division_id?: string; team_id?: string; role?: Role }[] = [];
  if (me.role === 'chairman') {
    choices.push({ key: 'all', label: 'Everyone', type: 'all' });
    for (const r of ['curator', 'executive', 'associate'] as Role[]) choices.push({ key: `r-${r}`, label: `All ${roleLabel[r].toLowerCase()}s`, type: 'role', role: r });
    for (const d of divisions) choices.push({ key: `d-${d.id}`, label: `${d.name} (division)`, type: 'division', division_id: d.id });
    for (const t of teams) choices.push({ key: `t-${t.id}`, label: t.name, type: 'team', team_id: t.id });
  } else if (me.role === 'curator') {
    if (canManageEvents(me)) choices.push({ key: 'all', label: 'Everyone', type: 'all' });
    const d = divisions.find((x) => x.id === me.division_id);
    if (d) choices.push({ key: `d-${d.id}`, label: `${d.name} (whole division)`, type: 'division', division_id: d.id });
    for (const t of teams.filter((x) => x.division_id === me.division_id)) choices.push({ key: `t-${t.id}`, label: t.name, type: 'team', team_id: t.id });
  } else if (me.role === 'executive' && me.team_id) {
    choices.push({ key: `t-${me.team_id}`, label: me.team_name ?? 'My team', type: 'team', team_id: me.team_id });
  }
  const [key, setKey] = useState(choices[0]?.key ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [confirmReq, setConfirmReq] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async () => {
    const c = choices.find((x) => x.key === key);
    if (!c || !title.trim() || !body.trim()) { setError('Add a title and a message.'); return; }
    setBusy(true);
    try {
      await api.postAnnouncement({
        audience_type: c.type, division_id: c.division_id ?? null, team_id: c.team_id ?? null, audience_role: c.role ?? null,
        title: title.trim(), body: body.trim(), pinned, needs_confirmation: confirmReq, image_url: image,
      });
      toast('ok', 'Posted.', `${c.label} will get a notification.`);
      setTitle(''); setBody(''); setPinned(false); setImage(null); setConfirmReq(false); setError(null);
      onPosted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New announcement"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={post} loading={busy}>Post</Button></>}>
      <div className="grid gap-s4">
        <Select label="To" value={key} onChange={(e) => setKey(e.target.value)}>
          {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        <PhotoPicker label="Photo for the billboard (optional)" url={image} folder="announcements" onChange={setImage} />
        <Check2 label="Pin to the top" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <Check2 label="Ask people to confirm they read it" checked={confirmReq} onChange={(e) => setConfirmReq(e.target.checked)} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
