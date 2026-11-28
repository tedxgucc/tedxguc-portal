'use client';
// Profile: change the sign-in email, and two-step sign-in.
import { Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import type { TwoStepState } from '@/lib/api/types';
import { needsTwoStep } from '@/lib/two-step';
import type { Role } from '@/lib/types';

export function AccountSecurity({ email, role }: { email: string; role: Role | null }) {
  const toast = useToast();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState<'email' | 'off' | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [two, setTwo] = useState<TwoStepState | null>(null);
  const required = needsTwoStep(role);
  useEffect(() => { api.twoStep().then(setTwo).catch(() => setTwo(null)); }, []);

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = next.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast('bad', 'Enter a valid email address.'); return; }
    if (v === email.toLowerCase()) { toast('bad', 'That’s already your email.'); return; }
    setBusy('email');
    try { await api.changeEmail(v); setSent(v); setNext(''); }
    catch (x) { toast('bad', 'Email not changed.', (x as Error).message); } finally { setBusy(null); }
  };
  const turnOff = async () => {
    if (!two?.factorId) return;
    setBusy('off');
    try { await api.removeTwoStep(two.factorId); setTwo({ enrolled: false, verified: false, factorId: null }); toast('ok', 'Two-step sign-in turned off.'); }
    catch (x) { toast('bad', 'Couldn’t turn it off.', (x as Error).message); } finally { setBusy(null); }
  };

  return (
    <>
      <form className="tx-card grid gap-s4 lg:col-start-1" onSubmit={changeEmail}>
        <h2 className="tx-heading h3"><Mail size={20} aria-hidden="true" />Change email</h2>
        <p className="text-body-sm text-ink-2">You sign in with <b>{email}</b>. To switch, enter the new email: we’ll send a confirmation link there, and your email changes once you tap it. Until then, the current one keeps working.</p>
        {sent && <p className="text-body-sm" role="status">Check <b>{sent}</b> for the confirmation email (and your current inbox for a notice). Open the link on any device.</p>}
        <TextInput label="New email" type="email" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} />
        <Button type="submit" variant="secondary" loading={busy === 'email'} className="justify-self-start">Send confirmation</Button>
      </form>
      <section className="tx-card grid gap-s3 lg:col-start-1" aria-labelledby="two-step">
        <h2 id="two-step" className="tx-heading h3"><ShieldCheck size={20} aria-hidden="true" />Two-step sign-in</h2>
        {two === null ? <p className="text-body-sm text-ink-3">Checking…</p> : two.enrolled ? <>
          <p className="text-body-sm text-ink-2"><b>On.</b> After your password, you enter a 6-digit code from your authenticator app.</p>
          {required
            ? <p className="text-caption text-ink-3">Required for your role. Got a new phone? Ask the Chairman to reset your login, then set it up again.</p>
            : <Button variant="secondary" onClick={turnOff} loading={busy === 'off'} className="justify-self-start">Turn off</Button>}
        </> : <>
          <p className="text-body-sm text-ink-2"><b>Off.</b> Add a second step: a 6-digit code from an app on your phone, after your password.{required ? ' Required for your role.' : ''}</p>
          <Link href="/auth/two-step?next=/portal/profile" className="tx-btn tx-btn--secondary justify-self-start">Set up two-step sign-in</Link>
        </>}
      </section>
    </>
  );
}
