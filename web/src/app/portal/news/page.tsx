'use client';
// Announcements (FR-8.1): Chairman → anyone; Curator → own division or one
// of its teams; Executive → own team. Read confirmations when asked.
import { Check, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { Billboard } from '@/components/portal/Billboard';
import { PhotoPicker } from '@/components/portal/PhotoPicker';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { announcementLive } from '@/lib/announcements';
import { fmtDateTime, fmtRelative, fromLocalInput, toLocalInput } from '@/lib/format';
import { canManageEvents, roleLabel } from '@/lib/roles';
import type { Announcement, AudienceType, Role } from '@/lib/types';

export default function NewsPage() {
  const { me, members, memberName, team, divisions } = usePortal();
  const toast = useToast();
  const [list, setList] = useState<Announcement[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [tracking, setTracking] = useState<Announcement | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = async () => {
    if (!deleting) return;
    setDeletingBusy(true); setDeleteError(null);
    try {
      await api.deleteAnnouncement(deleting.id);
      setDeleting(null); load(); toast('ok', 'Announcement deleted.');
    } catch (e) { setDeleteError((e as Error).message); }
    finally { setDeletingBusy(false); }
  };
  const load = useCallback(() => api.listAnnouncements().then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
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
                <Avatar photo={members.find((m) => m.user_id === a.author_id)?.photo_url} name={memberName(a.author_id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{memberName(a.author_id)}</div>
                  <div className="text-caption text-ink-3">To {audienceText(a)} · {fmtRelative(a.created_at)}</div>
                </div>
                {a.pinned && <span className="text-caption text-ink-2 flex items-center gap-s1"><Pin size={14} aria-hidden="true" />Pinned</span>}
              </header>
              {(a.author_id === me.id || me.role === 'chairman') && <div className="flex gap-s2">
                {canPost && <Button small variant="secondary" onClick={() => setEditing(a)}><Pencil size={16} aria-hidden="true" />Edit</Button>}
                <Button small variant="secondary" onClick={() => { setDeleting(a); setDeleteError(null); }}><Trash2 size={16} aria-hidden="true" />Delete</Button>
              </div>}
              {!announcementLive(a) && <Chip kind="soft">{a.publish_at && Date.parse(a.publish_at) > Date.now() ? 'Scheduled' : 'Expired'}</Chip>}
              {(a.publish_at || a.expires_at) && <p className="text-caption text-ink-3">{a.publish_at ? 'Publishes ' + fmtDateTime(a.publish_at) : ''}{a.expires_at ? ' / Expires ' + fmtDateTime(a.expires_at) : ''}</p>}
              <h2 className="h4">{a.title}</h2>
              {a.image_url && <img src={a.image_url} alt="" className="w-full max-h-[360px] object-cover" />} {/* eslint-disable-line @next/next/no-img-element */}
              <p className="text-ink-2 whitespace-pre-line">{a.body}</p>
              {a.needs_confirmation && (a.author_id === me.id || me.role === 'chairman') && <Button small variant="secondary" className="justify-self-start" onClick={() => setTracking(a)}>View read confirmations</Button>}
              {a.needs_confirmation && announcementLive(a) && (
                a.read_by_me
                  ? <Chip kind="ok">Confirmed</Chip>
                  : a.author_id !== me.id && <Button small variant="secondary" className="justify-self-start" onClick={() => confirm(a)}><Check aria-hidden="true" />I’ve read this</Button>
              )}
            </article>
          </li>
        ))}
      </ul>
      {tracking && <ConfirmationReport announcement={tracking} onClose={() => setTracking(null)} />}
      {editing && <Compose key={editing.id} announcement={editing} open onClose={() => setEditing(null)} onPosted={() => { setEditing(null); load(); }} />}
      <Modal open={!!deleting} title="Delete announcement?" onClose={() => { if (!deletingBusy) setDeleting(null); }}
        actions={<><Button variant="secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>Cancel</Button><Button loading={deletingBusy} onClick={remove}>Delete</Button></>}>
        <p>Delete ?{deleting?.title}?? This also removes its read confirmations and cannot be undone.</p>
        {deleteError && <p className="tx-help" role="alert">{deleteError}</p>}
      </Modal>
      {canPost && <Compose open={writing} onClose={() => setWriting(false)} onPosted={() => { setWriting(false); load(); }} />}
    </>
  );
}

function Compose({ open, onClose, onPosted, announcement }: { open: boolean; onClose: () => void; onPosted: () => void; announcement?: Announcement }) {
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
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const [image, setImage] = useState<string | null>(announcement?.image_url ?? null);
  const [confirmReq, setConfirmReq] = useState(announcement?.needs_confirmation ?? false);
  const [publishAt, setPublishAt] = useState(announcement?.publish_at ? toLocalInput(announcement.publish_at) : '');
  const [expiresAt, setExpiresAt] = useState(announcement?.expires_at ? toLocalInput(announcement.expires_at) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async () => {
    const c = choices.find((x) => x.key === key);
    if ((!announcement && !c) || !title.trim() || !body.trim()) { setError('Add a title and a message.'); return; }
    const publication = publishAt ? fromLocalInput(publishAt) : announcement?.publish_at ?? new Date().toISOString();
    const expiration = expiresAt ? fromLocalInput(expiresAt) : null;
    if (expiration && Date.parse(expiration) <= Date.parse(publication)) { setError('Expiry must be after publication.'); return; }
    setBusy(true);
    try {
      if (announcement) {
        await api.updateAnnouncement(announcement.id, { title: title.trim(), body: body.trim(), pinned, needs_confirmation: confirmReq, image_url: image, publish_at: publication, expires_at: expiration });
      } else if (c) await api.postAnnouncement({
        audience_type: c.type, division_id: c.division_id ?? null, team_id: c.team_id ?? null, audience_role: c.role ?? null,
        title: title.trim(), body: body.trim(), pinned, needs_confirmation: confirmReq, image_url: image, publish_at: publication, expires_at: expiration,
      });
      toast('ok', announcement ? 'Announcement updated.' : 'Posted.', !announcement && c ? Date.parse(publication) > Date.now() ? `Scheduled for ${fmtDateTime(publication)}.` : `${c.label} will get a notification.` : undefined);
      setTitle(''); setBody(''); setPinned(false); setImage(null); setConfirmReq(false); setPublishAt(''); setExpiresAt(''); setError(null);
      onPosted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={announcement ? 'Edit announcement' : 'New announcement'}
      actions={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button onClick={post} loading={busy}>{announcement ? 'Save changes' : 'Post'}</Button></>}>
      <div className="grid gap-s4">
        {!announcement && <Select label="To" value={key} onChange={(e) => setKey(e.target.value)}>
          {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>}
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        <PhotoPicker label="Photo for the billboard (optional)" url={image} folder="announcements" onChange={setImage} />
        <TextInput label="Publish at (Cairo time, optional)" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} help="Leave blank to publish now. Scheduled notifications are sent at publication." />
        <TextInput label="Expires at (Cairo time, optional)" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} help="Expired posts leave the billboard and audience feed. Authors can still manage them." />
        <Check2 label="Pin to the top" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <Check2 label="Ask people to confirm they read it" checked={confirmReq} onChange={(e) => setConfirmReq(e.target.checked)} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function ConfirmationReport({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const [rows, setRows] = useState<{ user_id: string; name: string; read_at: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => api.announcementConfirmations(announcement.id).then((r) => { if (alive) { setRows(r); setError(null); } }).catch((e) => { if (alive) setError((e as Error).message); });
    load(); const timer = setInterval(load, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [announcement.id]);
  return <Modal open title="Read confirmations" onClose={onClose}>
    <div className="grid gap-s3">
      <p className="font-semibold">{announcement.title}</p>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <Skeleton h={120} />}
      {rows && <>
        <p>{rows.filter((r) => r.read_at).length} of {rows.length} confirmed</p>
        <p className="text-caption text-ink-3">Current active audience, excluding the author.</p>
        <Check2 label="Show only people who have not confirmed" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
        <ul className="grid gap-s2">{rows.filter((r) => !onlyUnread || !r.read_at).map((r) => <li key={r.user_id} className="flex justify-between gap-s2"><span>{r.name}</span><span className="text-caption">{r.read_at ? 'Confirmed ' + fmtDateTime(r.read_at) : 'Not confirmed'}</span></li>)}</ul>
      </>}
    </div>
  </Modal>;
}
