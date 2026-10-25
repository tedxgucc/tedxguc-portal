'use client';
// Door check-in (FR-5.4, FR-5.7, FR-5.8): scan with the phone camera,
// works offline, prevents double entry, live count, manual lookup.
import { Camera, CameraOff, CloudOff, Download, Keyboard, RefreshCw, Search, Wifi, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { QrScanner } from '@/components/QrScanner';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Select, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { cairoDay, fmtDate, fmtTime } from '@/lib/format';
import { clearQueue, deviceId, loadManifest, offlineCheckIn, queue, saveManifest } from '@/lib/offline';
import { canScanAlways, isLpAssociate } from '@/lib/roles';
import type { CheckInResult, EventStats, SearchRow, TxEvent } from '@/lib/types';

type Shown = { kind: 'ok' | 'again' | 'bad'; title: string; detail: string };

const RESULT: Record<string, (r: Partial<CheckInResult>) => Shown> = {
  ok: (r) => ({ kind: 'ok', title: 'You’re in', detail: `${r.guest_name ?? ''}${r.guest_type === 'vip' ? ' · VIP' : ''}${r.ticket_no ? ` · ${r.ticket_no}` : ''}` }),
  already_checked_in: (r) => ({ kind: 'again', title: 'Already in', detail: `${r.guest_name ?? 'This ticket'} was scanned${r.checked_in_at ? ` at ${fmtTime(r.checked_in_at)}` : ' before'}.` }),
  not_found: () => ({ kind: 'bad', title: 'Not a ticket', detail: 'This code isn’t a ticket for this event.' }),
  cancelled: (r) => ({ kind: 'bad', title: 'Cancelled', detail: `${r.guest_name ?? 'This ticket'} was cancelled.` }),
  waitlisted: (r) => ({ kind: 'bad', title: 'Waitlist only', detail: `${r.guest_name ?? 'This guest'} is on the waitlist, not registered.` }),
};

function DoorInner() {
  const { me, doorEvents, eventsToday } = usePortal();
  // Chairman, Ops Curator, L&P Executives: every event. L&P Associates: today's
  // events. Door staff: the events they were added to.
  const always = canScanAlways(me);
  const allowed = (id: string) => always || (isLpAssociate(me) && eventsToday.includes(id)) || doorEvents.includes(id);
  const staffOnly = !always;
  const toast = useToast();
  const params = useSearchParams();
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [eventId, setEventId] = useState(params.get('event') ?? '');
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [camera, setCamera] = useState(false);
  const [pending, setPending] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState(false);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const device = useRef('door');

  useEffect(() => {
    device.current = deviceId();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    api.listAllEvents().then((all) => {
      const today = cairoDay(new Date());
      const evs = all.filter((e) => e.status === 'published' && cairoDay(e.starts_at) >= today && allowed(e.id))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      setEvents(evs);
      setEventId((cur) => cur || evs[0]?.id || '');
    }).catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [staffOnly, doorEvents, eventsToday]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [q, m] = await Promise.all([queue(eventId), loadManifest(eventId)]);
    setPending(q.length);
    setSavedAt(m?.savedAt ?? null);
    if (navigator.onLine) api.eventStats(eventId).then(setStats).catch(() => {});
  }, [eventId]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const sync = useCallback(async () => {
    if (!eventId || !navigator.onLine) return;
    const q = await queue(eventId);
    if (!q.length) return;
    try {
      const results = await api.syncOffline(eventId, q.map(({ ticket_code, scanned_at, device_id }) => ({ ticket_code, scanned_at, device_id })));
      await clearQueue(eventId);
      const conflicts = results.filter((r) => r.result !== 'ok');
      setSyncWarnings(conflicts.map((r) => `${r.guest_name ?? 'Unknown code'}: ${r.result === 'already_checked_in' ? 'also scanned at another door' : r.result.replace('_', ' ')}`));
      toast(conflicts.length ? 'warn' : 'ok', `Synced ${results.length} offline scans.`, conflicts.length ? `${conflicts.length} need a look.` : undefined);
      refresh();
    } catch (e) {
      toast('bad', 'Sync failed. We’ll try again.', (e as Error).message);
    }
  }, [eventId, refresh, toast]);
  useEffect(() => { if (online) sync(); }, [online, sync]);

  const download = async () => {
    try {
      const rows = await api.getManifest(eventId);
      await saveManifest(eventId, rows);
      toast('ok', 'Ready for offline.', `${rows.length} tickets saved on this phone.`);
      refresh();
    } catch (e) {
      toast('bad', "Couldn't download the list.", (e as Error).message);
    }
  };

  const show = (s: Shown) => {
    setShown(s);
    if (navigator.vibrate) navigator.vibrate(s.kind === 'ok' ? 30 : [60, 40, 60]);
    // Door mode resets after 1.6 s (design system: Check-in success).
    setTimeout(() => setShown((cur) => (cur === s ? null : cur)), 1600);
  };

  const handleCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || !eventId || busy.current) return;
    const now = Date.now();
    if (lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 3000) return;
    lastCode.current = { code, at: now };
    busy.current = true;
    try {
      if (navigator.onLine) {
        const r = await api.checkIn(eventId, code, device.current);
        show(RESULT[r.result](r));
        refresh();
      } else {
        const r = await offlineCheckIn(eventId, code, device.current);
        if (r.result === 'not_found' && !savedAt) {
          show({ kind: 'bad', title: 'No offline list', detail: 'Download the ticket list while you have internet.' });
        } else {
          show(RESULT[r.result]({ guest_name: r.row?.guest_name, ticket_no: r.row?.ticket_no, guest_type: r.row?.guest_type }));
        }
        refresh();
      }
    } catch (e) {
      // Network dropped mid-scan: fall back to the saved list.
      const r = await offlineCheckIn(eventId, code, device.current);
      if (savedAt) show(RESULT[r.result]({ guest_name: r.row?.guest_name, ticket_no: r.row?.ticket_no }));
      else toast('bad', 'That didn’t send.', (e as Error).message);
      refresh();
    } finally {
      busy.current = false;
    }
  }, [eventId, savedAt, refresh, toast]);

  if (staffOnly && doorEvents.length === 0 && !(isLpAssociate(me) && eventsToday.length)) {
    return <EmptyState title="No event to scan today">The scanner opens for L&P Associates on event days. Others need to be added as door staff.</EmptyState>;
  }
  const event = events.find((e) => e.id === eventId);
  const full = stats?.capacity ? Math.round((stats.checked_in / stats.capacity) * 100) : null;

  return (
    <>
      <PageTitle label="Door check-in" title={event?.title ?? 'Check-in'} />
      <div className="grid gap-s4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="grid gap-s4">
          {events.length > 1 && (
            <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {fmtDate(e.starts_at)}</option>)}
            </Select>
          )}

          <div className="tx-card grid gap-s4" aria-live="assertive">
            <QrScanner active={camera} onCode={handleCode} />
            {shown && (
              <div className="tx-checkin py-s4">
                <div className={`tx-checkin__stamp ${shown.kind === 'bad' ? 'is-bad' : shown.kind === 'again' ? 'is-warn' : ''}`}>
                  {shown.kind === 'ok' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg> : <X aria-hidden="true" />}
                </div>
                <div className="tx-checkin__t">{shown.title}</div>
                <p className="text-ink-2">{shown.detail}</p>
              </div>
            )}
            {!camera && !shown && (
              <div className="grid justify-items-center gap-s3 py-s6 text-center">
                <p className="text-ink-2">Point the camera at a ticket QR.</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-s2">
              <Button onClick={() => setCamera((c) => !c)} variant={camera ? 'secondary' : 'primary'} className="col-span-3 sm:col-span-1">
                {camera ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}{camera ? 'Stop' : 'Scan'}
              </Button>
              <Button variant="secondary" onClick={() => setManual(true)}><Keyboard aria-hidden="true" />Code</Button>
              <Button variant="secondary" onClick={() => setSearch(true)}><Search aria-hidden="true" />Name</Button>
            </div>
          </div>
        </div>

        <aside className="grid gap-s3" aria-label="Door status">
          <div className="tx-card tx-kpi">
            <span className="tx-label">Checked in</span>
            <span className="stat tx-num">{stats ? stats.checked_in.toLocaleString('en-US') : '–'}</span>
            <span className="caption tx-faint">{stats ? `of ${stats.registered.toLocaleString('en-US')} registered${full !== null ? ` · ${full}% of seats` : ''}` : 'Live count needs internet'}</span>
          </div>
          <div className="tx-card grid gap-s3">
            <div className="flex items-center justify-between">
              {online ? <Chip kind="ok">Online</Chip> : <Chip kind="warn">Offline</Chip>}
              {online ? <Wifi size={18} className="text-ink-3" aria-hidden="true" /> : <CloudOff size={18} className="text-warn-ink" aria-hidden="true" />}
            </div>
            <p className="text-body-sm text-ink-2">
              {savedAt ? `Ticket list saved ${fmtTime(savedAt)} on this phone.` : 'Save the ticket list before doors open, in case the Wi-Fi drops.'}
            </p>
            <Button variant="secondary" small onClick={download} disabled={!online || !eventId}><Download aria-hidden="true" />{savedAt ? 'Refresh offline list' : 'Download for offline'}</Button>
            {pending > 0 && (
              <div className="grid gap-s2">
                <Chip kind="pending">{pending} scans waiting to sync</Chip>
                <Button small onClick={sync} disabled={!online}><RefreshCw aria-hidden="true" />Sync now</Button>
              </div>
            )}
            {syncWarnings.length > 0 && (
              <ul className="grid gap-s1 text-body-sm" aria-label="Sync warnings">
                {syncWarnings.map((w, i) => <li key={i} className="text-warn-ink">{w}</li>)}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(c) => { setManual(false); handleCode(c); }} />
      <NameSearch open={search} onClose={() => setSearch(false)} eventId={eventId}
        onResult={(r) => { setSearch(false); show(RESULT[r.result](r)); refresh(); }} />
    </>
  );
}

function ManualCode({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (c: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Type the code"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { onCode(code); setCode(''); }} disabled={!code.trim()}>Check in</Button></>}>
      <TextInput label="Ticket code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" autoComplete="off" help="The long code inside the QR, if the camera can’t read it." />
    </Modal>
  );
}

function NameSearch({ open, onClose, eventId, onResult }: { open: boolean; onClose: () => void; eventId: string; onResult: (r: CheckInResult) => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SearchRow[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    const t = setTimeout(() => api.searchRegistrations(eventId, q).then(setRows).catch(() => setRows([])), 250);
    return () => clearTimeout(t);
  }, [q, eventId]);
  return (
    <Modal open={open} onClose={onClose} title="Find a guest">
      <div className="grid gap-s3">
        <TextInput label="Name, email or ticket number" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <ul className="grid gap-s1">
          {rows.map((r) => (
            <li key={r.registration_id} className="flex items-center gap-s3 py-s2 border-b border-line">
              <span className="flex-1 min-w-0">
                <span className="font-semibold block truncate">{r.guest_name}</span>
                <span className="text-caption text-ink-3">{r.email_hint}{r.ticket_no ? ` · ${r.ticket_no}` : ''}</span>
              </span>
              {r.checked_in_at ? <Chip kind="ok">In {fmtTime(r.checked_in_at)}</Chip>
                : r.status !== 'registered' ? <Chip kind="void">{r.status}</Chip>
                : <Button small onClick={async () => onResult(await api.checkInById(r.registration_id, deviceId()))}>Check in</Button>}
            </li>
          ))}
          {q.trim().length >= 2 && rows.length === 0 && <li className="text-ink-3 text-body-sm">No match.</li>}
        </ul>
        <p className="text-caption text-ink-3">Search needs internet. Emails are partly hidden.</p>
      </div>
    </Modal>
  );
}

export default function DoorPage() {
  return <Suspense><DoorInner /></Suspense>;
}
