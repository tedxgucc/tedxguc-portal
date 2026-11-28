'use client';
// Type the 6-digit code from an account email (invite or password reset), then
// choose a password. Works on any device: nothing depends on where the email opened.
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { clearCache } from '@/lib/cache';

function CodeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const type = params.get('type') === 'invite' ? 'invite' : 'recovery';
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.verifyEmailCode(email, code, type);
      clearCache();
      router.replace(`/auth/set-password?first=${type === 'invite' ? 1 : 0}`);
    } catch (x) { setError((x as Error).message); setBusy(false); }
  };

  return (
    <AuthCard tag={type === 'invite' ? 'PORTAL INVITE' : 'PASSWORD RESET'} title={type === 'invite' ? "You're on the team." : 'Enter your code.'}
      intro={type === 'invite' ? 'Type the 6-digit code from your invite email, then choose your password.' : 'Type the 6-digit code we emailed you, then choose a new password.'}>
      {error && <div className="login-message is-error" role="alert">{error}</div>}
      <form className="login-form" onSubmit={go} aria-busy={busy}>
        <label className="login-field"><span>Email address</span><span className="login-input-wrap"><Mail size={18} aria-hidden="true" />
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} /></span></label>
        <label className="login-field"><span>Code</span><span className="login-input-wrap"><KeyRound size={18} aria-hidden="true" />
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={12} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required disabled={busy} autoFocus style={{ letterSpacing: '.25em', fontVariantNumeric: 'tabular-nums' }} /></span></label>
        <Button block type="submit" loading={busy}>Continue<ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
      <p className="login-invite-note">Code expired or lost? <Link href={`/login?reset=1&email=${encodeURIComponent(email)}`} className="tx-link">Send me a new code</Link></p>
    </AuthCard>
  );
}

export default function AuthCode() {
  return <Suspense fallback={<div className="login-loading" role="status">Loading…</div>}><CodeInner /></Suspense>;
}
