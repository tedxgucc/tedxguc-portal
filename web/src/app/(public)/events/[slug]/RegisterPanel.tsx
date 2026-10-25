'use client';
// Guest registration (FR-5.2, FR-2.2): no account, consent required,
// custom questions, spam check. Lands on the private ticket page.
import { Ticket } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Turnstile } from '@/components/Turnstile';
import { useToast } from '@/components/Toast';
import { Button, Check2, Modal, Select, TextArea, TextInput } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { EventField, TxEvent } from '@/lib/types';

export function RegisterPanel({ event, fields, open, past, notYet }: {
  event: TxEvent; fields: EventField[]; open: boolean; past: boolean; notYet: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+20 ');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lost, setLost] = useState(false);

  if (past) {
    return <div className="tx-card grid gap-s2"><h2 className="h3 uppercase">This one’s over</h2><p className="text-ink-2">Thanks to everyone who came. Talks are shared online after each event.</p></div>;
  }
  if (!open) {
    return (
      <div className="tx-card grid gap-s3">
        <h2 className="h3 uppercase">{notYet ? 'Opening soon' : 'Registration closed'}</h2>
        <p className="text-ink-2">{notYet && event.registration_opens_at ? `Registration opens ${fmtDate(event.registration_opens_at)}.` : 'Registration for this event has closed.'}</p>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    for (const f of fields) if (f.required && !answers[f.id]?.trim()) e[f.id] = 'This one is required.';
    if (!consent) e.consent = 'Tick the box to continue.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await api.register({
        event_id: event.id, name, email, phone: phone.trim() === '+20' ? undefined : phone.trim(), answers, consent, turnstile_token: token,
      });
      router.push(`/tickets/${res.status_token}?new=1`);
    } catch (err) {
      const e = err as ApiError;
      toast('bad', "That didn't go through.", e.message);
      setBusy(false);
    }
  };

  return (
    <form className="tx-card grid gap-s4" onSubmit={submit} noValidate>
      <div className="grid gap-s1">
        <div className="tx-label">Free ticket</div>
        <h2 className="h3 uppercase">Get your ticket</h2>
      </div>
      <TextInput label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <TextInput label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
        error={errors.email} help="Your ticket and private link arrive here." required />
      <TextInput label="Phone (optional)" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {fields.map((f) => {
        const set = (v: string) => setAnswers((a) => ({ ...a, [f.id]: v }));
        const label = f.required ? f.label : `${f.label} (optional)`;
        if (f.kind === 'select') {
          return (
            <Select key={f.id} label={label} value={answers[f.id] ?? ''} onChange={(e) => set(e.target.value)} error={errors[f.id]}>
              <option value="">Choose…</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          );
        }
        if (f.kind === 'textarea') return <TextArea key={f.id} label={label} value={answers[f.id] ?? ''} onChange={(e) => set(e.target.value)} error={errors[f.id]} />;
        return <TextInput key={f.id} label={label} type={f.kind === 'number' ? 'number' : 'text'} value={answers[f.id] ?? ''} onChange={(e) => set(e.target.value)} error={errors[f.id]} />;
      })}
      <div className={errors.consent ? 'tx-field is-error' : ''}>
        <Check2 checked={consent} onChange={(e) => setConsent(e.target.checked)}
          label={<>I agree that TEDxGUC stores my details to run this event. <Link href="/privacy" className="tx-link">Privacy notice</Link></>} />
        {errors.consent && <p className="tx-help mt-s1" role="alert">{errors.consent}</p>}
      </div>
      <Turnstile onToken={setToken} />
      <Button type="submit" block loading={busy}><Ticket aria-hidden="true" />Claim free ticket</Button>
      <button type="button" className="tx-link text-body-sm justify-self-center bg-transparent border-0 cursor-pointer" onClick={() => setLost(true)}>Lost your ticket?</button>
      <ResendModal open={lost} onClose={() => setLost(false)} eventId={event.id} />
    </form>
  );
}

function ResendModal({ open, onClose, eventId }: { open: boolean; onClose: () => void; eventId: string }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.resendTicket(eventId, email);
      toast('ok', 'Check your inbox.', 'If this email is registered, we sent the ticket again.');
      onClose();
    } catch (err) {
      toast('bad', "That didn't send.", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Get your ticket again"
      actions={<><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="button" loading={busy} onClick={send}>Send</Button></>}>
      <p className="text-ink-2 mb-s4">Enter the email you registered with. We’ll send your ticket and a new private link; older links stop working.</p>
      <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
    </Modal>
  );
}
