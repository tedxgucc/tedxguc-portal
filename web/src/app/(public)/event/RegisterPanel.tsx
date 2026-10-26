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
import { GUEST_CATEGORIES, REFERRAL_SOURCES, registrationErrors, cleanRegistrationAnswers, guestTypeFor, ticketTier } from '@/lib/event-registration';
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
    const e = registrationErrors({ name, email, phone, answers });
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
        event_id: event.id, name: name.trim(), email: email.trim(), phone: phone.trim(), answers: cleanRegistrationAnswers(answers), consent, turnstile_token: token,
      });
      router.push(`/tickets?t=${res.status_token}&new=1`);
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
        <p className="text-body-sm text-ink-2">Be part of an inspiring experience where ideas come to life. Fill out the form to secure your spot. Slots are limited.</p>
      </div>
      <TextInput label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <Select label="Are you a GUCian?" value={answers.gucian ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, gucian: e.target.value, guc_id: '', national_id: '' }))} error={errors.gucian} required>
        <option value="">Choose…</option><option value="Yes">Yes</option><option value="No">No</option>
      </Select>
      {answers.gucian === 'Yes' && <TextInput label="GUC ID" maxLength={50} value={answers.guc_id ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, guc_id: e.target.value }))} error={errors.guc_id} required />}
      {answers.gucian === 'No' && <TextInput label="National ID number" maxLength={50} autoComplete="off" value={answers.national_id ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, national_id: e.target.value }))} error={errors.national_id} required />}
      <TextInput label="Personal email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
        error={errors.email} help="Your ticket and private link arrive here." required />
      <TextInput label="Phone number" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} required />
      <Select label="Guest type" value={answers.guest_category ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, guest_category: e.target.value }))} error={errors.guest_category} required>
        <option value="">Choose…</option>{GUEST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      {answers.guest_category && <p className="text-body-sm text-ink-2" aria-live="polite">Ticket type: <b>{ticketTier(guestTypeFor(answers.guest_category))}</b></p>}
      <Select label="How did you reach TEDxGUC?" value={answers.referral_source ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, referral_source: e.target.value, referral_other: '' }))} error={errors.referral_source} required>
        <option value="">Choose…</option>{REFERRAL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {answers.referral_source === 'Other' && <TextInput label="How did you hear about us?" maxLength={500} value={answers.referral_other ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, referral_other: e.target.value }))} error={errors.referral_other} required />}
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
      {errors.answers && <p className="tx-help" role="alert">{errors.answers}</p>}
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
