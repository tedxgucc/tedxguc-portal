'use client';
// Buyer's private order page (FR-16.3–16.9): pay by link with the order
// number in the note, upload the screenshot or reference, wait for
// approval, then show the pickup QR. Cash: pay at the booth before the hold ends.
import { Copy, ExternalLink, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { TxLabel } from '@/components/Brand';
import { QR } from '@/components/Ticket';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Skeleton, TextInput } from '@/components/ui';
import { packagesApi } from '@/lib/api/phase2b';
import { LICENSE_LINE } from '@/lib/env';
import { egp, fmtDateTime } from '@/lib/format';
import type { OrderView } from '@/lib/types';

const title: Record<OrderView['status'], string> = {
  pending_proof: 'Pay now', pending_approval: 'Payment received', awaiting_cash: 'Pay at the booth', approved: 'You’re set',
  delivered: 'Picked up', rejected: 'Payment not confirmed', expired: 'Order expired', cancelled: 'Order cancelled', refunded: 'Refunded',
};

function OrderInner() {
  const token = useSearchParams().get('t') ?? '';
  const isNew = useSearchParams().get('new') === '1';
  const toast = useToast();
  const [o, setO] = useState<OrderView | null | undefined>(undefined);
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => packagesApi.getOrder(token).then(setO).catch(() => setO(null)), [token]);
  useEffect(() => { load(); }, [load]);

  const sendProof = async () => {
    if (!file && !ref.trim()) { toast('bad', 'Add the screenshot or the transaction reference.'); return; }
    setBusy('proof');
    try {
      const path = file ? await packagesApi.uploadProof(token, file) : null;
      await packagesApi.submitProof(token, path, ref.trim() || null);
      toast('ok', 'Payment received.', 'We’ll confirm within 24 hours.');
      setFile(null); setRef('');
      load();
    } catch (e) { toast('bad', 'We can’t read that screenshot.', (e as Error).message); } finally { setBusy(null); }
  };
  const cancel = async () => {
    setBusy('cancel');
    try { await packagesApi.cancelOrder(token); setConfirm(false); toast('ok', 'Order cancelled.'); load(); }
    catch (e) { toast('bad', 'That didn’t cancel.', (e as Error).message); } finally { setBusy(null); }
  };

  if (o === undefined) return <div className="mx-auto max-w-[720px] px-s4 pt-s7"><Skeleton h={360} /></div>;
  if (o === null) return <div className="mx-auto max-w-[720px] px-s4 pt-s7"><EmptyState title="We can’t find that order." action={<Link href="/portal/signups" className="tx-btn tx-btn--secondary">My sign-ups</Link>}>Check the newest email we sent you.</EmptyState></div>;

  return (
    <div className="mx-auto max-w-[720px] px-s4 md:px-s6 pt-s7 grid gap-s5">
      <header className="grid gap-s2">
        <TxLabel>Order <b>{o.order_no}</b></TxLabel>
        <h1 className="h1 uppercase">{title[o.status]}</h1>
        <p className="text-ink-2">{o.quantity} × {o.package} · {egp(o.total_egp)}{isNew ? '. You can reopen it any time from Sign-ups in the portal.' : ''}</p>
      </header>

      {o.status === 'pending_proof' && (
        <section className="tx-card grid gap-s4" aria-labelledby="pay">
          <h2 id="pay" className="tx-heading h3">1. Transfer {egp(o.total_egp)}</h2>
          <p className="text-ink-2">Write <b className="code">{o.order_no}</b> in the transfer note so we can match it.
            <button className="tx-iconbtn align-middle" aria-label="Copy order number" onClick={() => { navigator.clipboard?.writeText(o.order_no); toast('ok', 'Order number copied.'); }}><Copy size={16} /></button></p>
          {o.payment_link && <a className="tx-btn tx-btn--primary justify-self-start" href={o.payment_link} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open {o.method === 'telda' ? 'Telda' : 'InstaPay'}</a>}
          {o.hold_expires_at && <p className="text-caption text-ink-3">We hold your order until {fmtDateTime(o.hold_expires_at)}.</p>}
          <h2 className="tx-heading h3">2. Send us the proof</h2>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? <div className="tx-file"><div className="tx-file__thumb"><Upload aria-hidden="true" /></div><div className="min-w-0"><div className="font-semibold truncate text-body-sm">{file.name}</div></div>
            <button className="tx-link text-caption bg-transparent border-0 cursor-pointer" onClick={() => setFile(null)}>Change</button></div>
            : <button type="button" className="tx-upload w-full" onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" /><span className="tx-upload__t">Upload the transfer screenshot</span><span className="tx-upload__d">Show the amount and the reference. Up to 5 MB.</span></button>}
          <TextInput label="Or the transaction reference" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />
          <Button onClick={sendProof} loading={busy === 'proof'}>Send proof</Button>
        </section>
      )}

      {o.status === 'pending_approval' && <div className="tx-card grid gap-s2"><Chip kind="pending">Checking your transfer</Chip><p className="text-ink-2">Our Operations team checks the {o.method === 'telda' ? 'Telda' : 'InstaPay'} account and confirms within 24 hours. You’ll get an email with your pickup QR.</p></div>}

      {o.status === 'awaiting_cash' && (
        <div className="tx-card grid gap-s2">
          <Chip kind="pending">Reserved</Chip>
          <p className="text-ink-2">Pay {egp(o.total_egp)} in cash at the TEDxGUC booth{o.pickup_info ? ` (${o.pickup_info})` : ''}{o.hold_expires_at ? ` before ${fmtDateTime(o.hold_expires_at)}` : ''}. Tell them order <b className="code">{o.order_no}</b>.</p>
        </div>
      )}

      {o.status === 'approved' && o.pickup_code && (
        <div className="grid justify-items-center gap-s3">
          <div className="tx-ticket">
            <div className="tx-ticket__top"><div className="tx-ticket__event">{o.package}</div><div className="caption" style={{ color: '#b8b8b8' }}>{o.quantity} × · {egp(o.total_egp)}</div></div>
            <div className="tx-ticket__perf" />
            <div className="tx-ticket__body">
              <QR value={o.pickup_code} label={`Pickup QR for ${o.order_no}`} />
              <div className="tx-ticket__code">{o.order_no}</div>
              {o.pickup_info && <div className="text-center text-body-sm" style={{ color: '#0a0a0a' }}>Pick up at {o.pickup_info}</div>}
            </div>
            <div className="tx-ticket__bar" />
          </div>
          <p className="text-ink-2 text-center">Show this QR when you collect. It works once.</p>
        </div>
      )}

      {o.status === 'delivered' && <div className="tx-card"><Chip kind="ok">Picked up</Chip><p className="text-ink-2 mt-s2">Enjoy it.</p></div>}
      {o.status === 'rejected' && <div className="tx-card grid gap-s2"><Chip kind="bad">Not confirmed</Chip><p className="text-ink-2">{o.reject_reason ?? 'We couldn’t find your transfer.'} If you did pay, reply to our email with the screenshot and we’ll sort it out.</p></div>}
      {['expired', 'cancelled', 'refunded'].includes(o.status) && <EmptyState title={title[o.status]} action={<Link href="/portal/signups" className="tx-btn tx-btn--secondary">My sign-ups</Link>}>{o.status === 'expired' ? 'The hold ran out before payment. You can order again while stock lasts.' : o.status === 'refunded' ? 'Your money was returned.' : 'This order was cancelled.'}</EmptyState>}

      {['pending_proof', 'awaiting_cash'].includes(o.status) && (
        <button className="tx-link text-body-sm justify-self-start bg-transparent border-0 cursor-pointer" onClick={() => setConfirm(true)}>Cancel this order</button>
      )}
      <p className="tx-legal">{LICENSE_LINE}</p>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Cancel order ${o.order_no}?`}
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)}>Keep it</Button><Button variant="danger" onClick={cancel} loading={busy === 'cancel'}>Cancel order</Button></>}>
        <p className="text-ink-2">The package goes back on sale for someone else.</p>
      </Modal>
    </div>
  );
}

export default function OrderPage() {
  return <Suspense><OrderInner /></Suspense>;
}
