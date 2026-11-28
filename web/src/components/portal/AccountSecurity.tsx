'use client';
// Profile: change the sign-in email. A 6-digit code goes to the new address;
// the email changes once that code is typed here.
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import type { Role } from '@/lib/types';

export function AccountSecurity({ email }: { email: string; role?: Role | null }) {
  const toast = useToast();
  const [next, setNext] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'code' | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = next.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast('bad', 'Enter a valid email address.'); return; }
    if (v === email.toLowerCase()) { toast('bad', 'That’s already your email.'); return; }
    setBusy('send');
    try { await api.changeEmail(v); setSentTo(v); setCode(''); }
    catch (x) { toast('bad', 'Code not sent.', (x as Error).message); } finally { setBusy(null); }
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setBusy('code');
    try {
      await api.verifyEmailCode(sentTo, code, 'email_change');
      clearCache();
      toast('ok', 'Email changed.', `Sign in with ${sentTo} from now on.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (x) { toast('bad', 'Email not changed.', (x as Error).message); setBusy(null); }
  };

  return (
    <section className="tx-card grid gap-s4 lg:col-start-1" aria-labelledby="change-email">
      <h2 id="change-email" className="tx-heading h3"><Mail size={20} aria-hidden="true" />Change email</h2>
      <p className="text-body-sm text-ink-2">You sign in with <b>{email}</b>. To switch, we’ll email a 6-digit code to the new address. Your email changes once you type it here.</p>
      {!sentTo ? (
        <form className="grid gap-s4" onSubmit={send}>
          <TextInput label="New email" type="email" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} />
          <Button type="submit" variant="secondary" loading={busy === 'send'} className="justify-self-start">Email me a code</Button>
        </form>
      ) : (
        <form className="grid gap-s4" onSubmit={confirm}>
          <p className="text-body-sm" role="status">We sent a code to <b>{sentTo}</b>. Check spam too.</p>
          <TextInput label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex flex-wrap gap-s2">
            <Button type="submit" loading={busy === 'code'}>Confirm new email</Button>
            <Button type="button" variant="secondary" onClick={() => { setSentTo(null); setCode(''); }}>Use a different email</Button>
          </div>
        </form>
      )}
    </section>
  );
}
