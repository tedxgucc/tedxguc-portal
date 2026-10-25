'use client';
// "Become a partner" and contact form (FR-1.5, FR-1.7).
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Turnstile } from './Turnstile';
import { useToast } from './Toast';
import { Button, Check2, TextArea, TextInput } from './ui';

export function InquiryForm({ kind }: { kind: 'partner' | 'contact' }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = 'Enter your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) err.email = 'Enter a valid email address.';
    if (!f.message.trim()) err.message = 'Write a short message.';
    if (!consent) err.consent = 'Tick the box to continue.';
    setError(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await api.sendInquiry({ kind, ...f, consent, turnstile_token: token });
      setSent(true);
    } catch (x) {
      toast('bad', "That didn't send.", (x as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="tx-card grid gap-s2" role="status">
        <h3 className="h3 uppercase">Message sent</h3>
        <p className="text-ink-2">{kind === 'partner' ? 'Our Partnerships team will reply within a few days.' : 'We read every message and reply within a few days.'}</p>
      </div>
    );
  }
  return (
    <form className="tx-card grid gap-s4" onSubmit={submit} noValidate>
      <div className="grid gap-s4 md:grid-cols-2">
        <TextInput label="Name" value={f.name} onChange={set('name')} autoComplete="name" error={error.name} />
        <TextInput label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={error.email} />
        {kind === 'partner' && <TextInput label="Company" value={f.company} onChange={set('company')} autoComplete="organization" />}
        <TextInput label="Phone (optional)" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
      </div>
      <TextArea label={kind === 'partner' ? 'How would you like to partner?' : 'Message'} value={f.message} onChange={set('message')} error={error.message} />
      <div className={error.consent ? 'tx-field is-error' : ''}>
        <Check2 checked={consent} onChange={(e) => setConsent(e.target.checked)}
          label={<>TEDxGUC may store these details to reply to me. <Link href="/privacy" className="tx-link">Privacy notice</Link></>} />
        {error.consent && <p className="tx-help mt-s1" role="alert">{error.consent}</p>}
      </div>
      <Turnstile onToken={setToken} />
      <Button type="submit" loading={busy} className="justify-self-start"><Send aria-hidden="true" />Send</Button>
    </form>
  );
}
