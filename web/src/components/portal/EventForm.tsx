'use client';
// Create / edit an event (FR-5.1) on a full-screen sheet with room for
// everything: who sees it (public site, or internal: announcements and the
// club calendar), cover photo, agenda and speakers with photos.
// TEDx events can't go public unlicensed (FR-1.8).
import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PhotoPicker } from '@/components/portal/PhotoPicker';
import { useToast } from '@/components/Toast';
import { Button, Check2, Segmented, Select, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { adminApi } from '@/lib/api/admin';
import { fmtDate, fromLocalInput, toLocalInput } from '@/lib/format';
import type { AgendaItem, EventStatus, EventType, LicenseStatus, Speaker, TxEvent } from '@/lib/types';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
type SpeakerDraft = Omit<Speaker, 'id' | 'event_id'> & { id?: string; key: string };
const key = () => Math.random().toString(36).slice(2, 9);

export function EventForm({ open, onClose, onSaved, event }: { open: boolean; onClose: () => void; onSaved: (e: TxEvent) => void; event?: TxEvent | null }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({
    title: event?.title ?? '',
    type: (event?.type ?? 'salon') as EventType,
    slug: event?.slug ?? '',
    description: event?.description ?? '',
    starts_at: event ? toLocalInput(event.starts_at) : '',
    ends_at: event?.ends_at ? toLocalInput(event.ends_at) : '',
    venue: event?.venue ?? '',
    capacity: event?.capacity?.toString() ?? '',
    registration_opens_at: event?.registration_opens_at ? toLocalInput(event.registration_opens_at) : '',
    registration_closes_at: event?.registration_closes_at ? toLocalInput(event.registration_closes_at) : '',
    license_status: (event?.license_status ?? 'pending') as LicenseStatus,
    is_public: event?.is_public ?? true,
    status: (event?.status ?? 'draft') as EventStatus,
    ticket_prefix: event?.ticket_prefix ?? 'TX',
    cover_url: event?.cover_url ?? null,
  }));
  const [agenda, setAgenda] = useState<(AgendaItem & { key: string })[]>(() => (event?.agenda ?? []).map((a) => ({ ...a, key: key() })));
  const [speakers, setSpeakers] = useState<SpeakerDraft[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [announce, setAnnounce] = useState(!event);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const isTedx = f.type === 'main_event' || f.type === 'salon';

  useEffect(() => {
    if (!event) return;
    adminApi.listEventSpeakers(event.id).then((l) => setSpeakers(l.map((s) => ({ ...s, key: s.id })))).catch(() => {});
  }, [event]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open, onClose]);
  if (!open) return null;

  const save = async () => {
    if (!f.title.trim() || !f.starts_at) { setError('Add a title and a start time.'); return; }
    if (f.is_public && isTedx && f.license_status === 'not_required') { setError('Main Events and Salons need a TEDx license.'); return; }
    if (f.status === 'published' && f.is_public && isTedx && f.license_status !== 'licensed') {
      setError('A public TEDx event needs its license before publishing. Keep it as a draft, or make it internal.');
      return;
    }
    if (speakers.some((s) => !s.name.trim())) { setError('Every speaker needs a name.'); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveEvent({
        id: event?.id,
        title: f.title.trim(), type: f.type, slug: f.slug.trim() || slugify(f.title), description: f.description.trim() || null,
        agenda: agenda.filter((a) => a.title.trim()).map(({ key: _k, ...a }) => ({ time: a.time, title: a.title.trim(), ...(a.speaker?.trim() ? { speaker: a.speaker.trim() } : {}) })),
        starts_at: fromLocalInput(f.starts_at), ends_at: f.ends_at ? fromLocalInput(f.ends_at) : null,
        venue: f.venue.trim() || null, capacity: f.capacity ? Number(f.capacity) : null,
        registration_opens_at: f.is_public && f.registration_opens_at ? fromLocalInput(f.registration_opens_at) : null,
        registration_closes_at: f.is_public && f.registration_closes_at ? fromLocalInput(f.registration_closes_at) : null,
        license_status: f.license_status, is_public: f.is_public, status: f.status, ticket_prefix: f.ticket_prefix.trim().toUpperCase() || 'TX',
        cover_url: f.cover_url,
      });
      for (const id of removed) await adminApi.deleteSpeaker(id);
      for (const s of speakers) {
        const { key: _k, ...row } = s;
        await adminApi.saveSpeaker({ ...row, name: row.name.trim(), event_id: saved.id });
      }
      // Internal events are announced to the club; the calendar shows them already.
      if (!f.is_public && announce && f.status === 'published') {
        await api.postAnnouncement({
          audience_type: 'all', title: `${f.title.trim()} · ${fmtDate(saved.starts_at)}`,
          body: [f.description.trim(), f.venue.trim() ? `Where: ${f.venue.trim()}` : ''].filter(Boolean).join('\n\n') || 'See the club calendar for details.',
          pinned: true, image_url: f.cover_url,
        }).catch(() => toast('warn', 'Event saved, announcement not posted.', 'Post it from Announcements.'));
      }
      toast('ok', event ? 'Event saved.' : 'Event created.', f.is_public ? 'It shows on the site once published.' : 'Members see it in the calendar.');
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const section = (title: string, children: React.ReactNode, note?: string) => (
    <section className="grid gap-s4 py-s5 border-b border-line">
      <div className="grid gap-s1"><h3 className="tx-heading h3">{title}</h3>{note && <p className="text-body-sm text-ink-2">{note}</p>}</div>
      {children}
    </section>
  );

  // Rendered on <body> so it covers the portal's top bar and tab bar.
  return createPortal(
    <div className="fixed inset-0 z-modal bg-bg overflow-y-auto" role="dialog" aria-modal="true" aria-label={event ? `Edit ${event.title}` : 'New event'}>
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="mx-auto max-w-[900px] px-s4 md:px-s6 h-[64px] flex items-center justify-between gap-s3">
          <h2 className="h3 uppercase truncate">{event ? `Edit ${event.title}` : 'New event'}</h2>
          <button type="button" className="tx-iconbtn" aria-label="Close" onClick={onClose}><X /></button>
        </div>
      </header>

      <div className="mx-auto max-w-[900px] px-s4 md:px-s6 pb-[120px]">
        {section('The basics', (
          <div className="grid gap-s4">
            <TextInput label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} />
            <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
              <Select label="Type" value={f.type} onChange={(e) => set('type', e.target.value as EventType)}>
                <option value="main_event">Main Event</option><option value="salon">Salon</option><option value="workshop">Workshop</option><option value="other">Other</option>
              </Select>
              <Select label="Status" value={f.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
                <option value="draft">Draft (only Operations sees it)</option><option value="published">Published</option>
                <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <TextArea label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} />
          </div>
        ))}

        {section('Who sees it', (
          <div className="grid gap-s3">
            <Segmented label="Visibility" value={f.is_public ? 'public' : 'internal'} onChange={(v) => set('is_public', v === 'public')}
              options={[{ value: 'public', label: 'General · on the site' }, { value: 'internal', label: 'Internal · club only' }]} />
            <p className="text-body-sm text-ink-2">{f.is_public
              ? 'Shown on the public website with registration and tickets.'
              : 'Not on the website. Members see it in the portal calendar and in Announcements.'}</p>
            {!f.is_public && !event && <Check2 label="Announce it to the whole club when published" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />}
          </div>
        ))}

        {section('Cover photo', <div className="max-w-[560px]"><PhotoPicker label="Photo" url={f.cover_url} folder="events" onChange={(u) => set('cover_url', u)} /></div>,
          'Shown at the top of the event page and on the announcement billboard. Wide photos work best.')}

        {section('When and where', (
          <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
            <TextInput label="Starts" type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
            <TextInput label="Ends" type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
            <TextInput label="Venue" value={f.venue} onChange={(e) => set('venue', e.target.value)} />
            <TextInput label="Capacity" type="number" min={1} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} help="Empty = no limit. When full, guests join the waitlist." />
          </div>
        ))}

        {f.is_public && section('Registration and tickets', (
          <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
            <TextInput label="Registration opens" type="datetime-local" value={f.registration_opens_at} onChange={(e) => set('registration_opens_at', e.target.value)} />
            <TextInput label="Registration closes" type="datetime-local" value={f.registration_closes_at} onChange={(e) => set('registration_closes_at', e.target.value)} />
            <Select label="TEDx license" value={f.license_status} onChange={(e) => set('license_status', e.target.value as LicenseStatus)}>
              <option value="pending">Pending</option><option value="licensed">Licensed</option>
              {!isTedx && <option value="not_required">Not needed</option>}
            </Select>
            <TextInput label="Ticket prefix" value={f.ticket_prefix} onChange={(e) => set('ticket_prefix', e.target.value)} help="e.g. TX27 → TX27-0001" />
            <div className="sm:col-span-2"><TextInput label="Web address" value={f.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder={slugify(f.title) || 'loose-ends'} help={`/event?s=${f.slug || slugify(f.title) || '…'}`} /></div>
          </div>
        ))}

        {section('Agenda', (
          <div className="grid gap-s3">
            {agenda.length === 0 && <p className="text-body-sm text-ink-3">No agenda yet.</p>}
            {agenda.map((a, i) => (
              <div key={a.key} className="tx-card grid gap-s3 grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,200px)_auto] sm:items-end">
                <TextInput label="Time" type="time" value={a.time} onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                <TextInput label="What" value={a.title} onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Doors open" />
                <Select label="Speaker (optional)" value={a.speaker ?? ''} onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, speaker: e.target.value } : x)))}>
                  <option value="">None</option>
                  {speakers.filter((s) => s.name.trim()).map((s) => <option key={s.key} value={s.name}>{s.name}</option>)}
                </Select>
                <button type="button" className="tx-iconbtn justify-self-end" aria-label={`Remove agenda item ${i + 1}`} onClick={() => setAgenda(agenda.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
            ))}
            <div><Button type="button" variant="secondary" small onClick={() => setAgenda([...agenda, { key: key(), time: agenda.at(-1)?.time ?? '18:00', title: '' }])}><Plus size={16} aria-hidden="true" />Add to agenda</Button></div>
          </div>
        ), 'In order. Guests see it on the event page.')}

        {section('Speakers', (
          <div className="grid gap-s3">
            {speakers.length === 0 && <p className="text-body-sm text-ink-3">No speakers yet.</p>}
            {speakers.map((s, i) => {
              const upd = (patch: Partial<SpeakerDraft>) => setSpeakers(speakers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={s.key} className="tx-card grid gap-s4 grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <PhotoPicker label="Photo" round url={s.photo_url} folder="speakers" onChange={(u) => upd({ photo_url: u })} />
                  <div className="grid gap-s3 min-w-0">
                    <div className="grid gap-s3 grid-cols-1 sm:grid-cols-2">
                      <TextInput label="Name" value={s.name} onChange={(e) => upd({ name: e.target.value })} />
                      <TextInput label="Talk title" value={s.talk_title ?? ''} onChange={(e) => upd({ talk_title: e.target.value || null })} />
                    </div>
                    <TextArea label="Short bio" rows={2} value={s.bio ?? ''} onChange={(e) => upd({ bio: e.target.value || null })} />
                    <div className="flex justify-end">
                      <Button type="button" small variant="ghost" onClick={() => { if (s.id) setRemoved([...removed, s.id]); setSpeakers(speakers.filter((_, j) => j !== i)); }}><Trash2 size={16} aria-hidden="true" />Remove speaker</Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div><Button type="button" variant="secondary" small onClick={() => setSpeakers([...speakers, { key: key(), name: '', bio: null, photo_url: null, talk_title: null, talk_url: null }])}><Plus size={16} aria-hidden="true" />Add speaker</Button></div>
          </div>
        ), f.is_public ? 'Shown on the event page and the Speakers page.' : undefined)}
      </div>

      <footer className="fixed bottom-0 inset-x-0 z-10 bg-surface-1 border-t border-line">
        <div className="mx-auto max-w-[900px] px-s4 md:px-s6 py-s3 grid gap-s2">
          {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
          <div className="flex justify-end gap-s2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={busy}>{event ? 'Save' : 'Create event'}</Button>
          </div>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
