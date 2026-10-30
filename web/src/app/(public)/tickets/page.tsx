'use client';
// The guest's private ticket page (FR-2.2, FR-5.3). Only someone with the
// link can open it. Shows the QR ticket, waitlist place, or cancellation.
import { CalendarPlus, Download, MessageCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TxLabel } from '@/components/Brand';
import { Ticket } from '@/components/Ticket';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { LICENSE_LINE } from '@/lib/env';
import { fmtDate, fmtTime } from '@/lib/format';
import type { TicketView } from '@/lib/types';

function TicketPageInner() {
  const token = useSearchParams().get('t') ?? '';
  const isNew = useSearchParams().get('new') === '1';
  const toast = useToast();
  const [t, setT] = useState<TicketView | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.getTicket(token).then(setT).catch(() => setT(null)), [token]);
  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelTicket(token);
      toast('ok', 'Ticket cancelled.', 'Your seat goes to the next person on the waitlist.');
      setConfirm(false);
      await load();
    } catch (err) {
      toast('bad', "That didn't go through.", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    const ticket = document.getElementById('ticket');
    if (!ticket || !t?.ticket_no) return;
    setSaving(true);
    try {
      const { downloadTicketPng } = await import('@/lib/download-ticket');
      await downloadTicketPng(ticket, t.ticket_no);
    } catch {
      toast('bad', 'Ticket could not be saved.', 'Please try again once the ticket has finished loading.');
    } finally {
      setSaving(false);
    }
  };

  const calendarLink = (v: TicketView) => {
    const f = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = v.event.ends_at ?? new Date(new Date(v.event.starts_at).getTime() + 3 * 3600_000).toISOString();
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `${v.event.title} · TEDxGUC`, dates: `${f(v.event.starts_at)}/${f(end)}`, location: v.event.venue ?? '' });
    return `https://calendar.google.com/calendar/render?${q}`;
  };

  return (
    <div className="mx-auto max-w-[720px] px-s4 md:px-s6 pt-s7 grid gap-s6">
      {t === undefined && <div className="grid gap-s3 justify-items-center"><Skeleton h={48} w="60%" /><Skeleton h={420} w={340} /></div>}

      {t === null && (
        <EmptyState title="We can’t find that ticket." action={<Link href="/events" className="tx-btn tx-btn--secondary">See events</Link>}>
          This link may be old. If you asked for your ticket again, use the newest email.
        </EmptyState>
      )}

      {t && t.status === 'registered' && t.ticket_code && t.ticket_no && (
        <>
          <header className="grid gap-s2 text-center justify-items-center">
            <TxLabel>{t.checked_in_at ? 'Checked in' : 'Your ticket'}</TxLabel>
            <h1 className="h1 uppercase">{t.checked_in_at ? 'Enjoy the day' : isNew ? 'You’re in' : 'See you there'}</h1>
            <p className="text-ink-2">{isNew ? 'Your ticket is below and in your inbox. ' : ''}Show the QR at the door. It works once.</p>
          </header>
          <div className="grid justify-items-center">
            <Ticket eventTitle={t.event.title} eventKind="TEDxGUC" guestName={t.guest_name} guestType={t.guest_type} startsAt={t.event.starts_at}
              partners={t.event.ticket_partners} venue={t.event.venue} ticketNo={t.ticket_no} code={t.ticket_code} />
          </div>
          {t.checked_in_at && <div className="justify-self-center"><Chip kind="ok">Checked in {fmtTime(t.checked_in_at)}</Chip></div>}
          <div className="grid gap-s2 sm:grid-cols-3">
            <Button variant="secondary" onClick={saveImage} loading={saving}><Download aria-hidden="true" />Save ticket PNG</Button>
            <a className="tx-btn tx-btn--secondary" href={calendarLink(t)} target="_blank" rel="noopener noreferrer"><CalendarPlus aria-hidden="true" />Calendar</a>
            <a className="tx-btn tx-btn--secondary" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`My TEDxGUC ticket for ${t.event.title}: ${typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''}`)}`}>
              <MessageCircle aria-hidden="true" />WhatsApp
            </a>
          </div>
          {!t.checked_in_at && (
            <button className="tx-link text-body-sm justify-self-center bg-transparent border-0 cursor-pointer" onClick={() => setConfirm(true)}>
              Can’t make it? Cancel your ticket
            </button>
          )}
        </>
      )}

      {t && t.status === 'waitlisted' && (
        <div className="tx-card grid gap-s4 text-center justify-items-center">
          <TxLabel>Waitlist</TxLabel>
          <h1 className="h1 uppercase">You’re number {t.waitlist_position}</h1>
          <p className="text-ink-2 max-w-[440px]">All seats for {t.event.title} are taken right now. If one frees up, we’ll email your ticket automatically. Keep this link.</p>
          <p className="text-body-sm text-ink-3">{fmtDate(t.event.starts_at)} · {fmtTime(t.event.starts_at)}{t.event.venue ? ` · ${t.event.venue}` : ''}</p>
          <button className="tx-link text-body-sm bg-transparent border-0 cursor-pointer" onClick={() => setConfirm(true)}>Leave the waitlist</button>
        </div>
      )}

      {t && t.status === 'cancelled' && (
        <EmptyState title="This ticket is cancelled." action={<Link href="/events" className="tx-btn tx-btn--secondary">See events</Link>}>
          Changed your mind? Register again from the event page while seats last.
        </EmptyState>
      )}

      <p className="tx-legal text-center">{LICENSE_LINE}</p>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t?.status === 'waitlisted' ? 'Leave the waitlist?' : `Cancel your ticket for ${t?.event.title ?? 'this event'}?`}
        actions={<>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Keep it</Button>
          <Button variant="danger" loading={busy} onClick={cancel}><XCircle aria-hidden="true" />Cancel</Button>
        </>}>
        <p className="text-ink-2">Your seat goes to the next person on the waitlist. You can register again later if seats are left.</p>
      </Modal>
    </div>
  );
}

export default function TicketPage() {
  return <Suspense><TicketPageInner /></Suspense>;
}
