'use client';
// Two-step sign-in with an authenticator app (Google Authenticator, Microsoft
// Authenticator, 1Password…). First time: scan the QR and confirm a code. After
// that: enter the 6-digit code after the password.
import { ArrowRight, KeyRound, Smartphone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { clearCache } from '@/lib/cache';

function TwoStepInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/portal') ? nextParam : '/portal';
  const [state, setState] = useState<'loading' | 'setup' | 'code' | 'failed'>('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMe();
        if (!me) { router.replace('/login'); return; }
        const s = await api.twoStep();
        if (s.verified) { router.replace(next); return; }
        if (s.enrolled && s.factorId) { setFactorId(s.factorId); setState('code'); return; }
        const f = await api.startTwoStepSetup();
        setFactorId(f.factorId); setQr(f.qr); setSecret(f.secret); setState('setup');
      } catch (e) { setError((e as Error).message); setState('failed'); }
    })();
  }, [router, next]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, '').length !== 6) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setError(null);
    try { await api.confirmTwoStep(factorId, code); clearCache(); router.replace(next); }
    catch (x) { setError((x as Error).message); setBusy(false); setCode(''); }
  };

  const codeField = (
    <form className="login-form" onSubmit={verify} aria-busy={busy}>
      <label className="login-field"><span>6-digit code</span><span className="login-input-wrap"><KeyRound size={18} aria-hidden="true" />
        <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123 456" value={code} onChange={(e) => setCode(e.target.value)} required disabled={busy} autoFocus style={{ letterSpacing: '.3em', fontVariantNumeric: 'tabular-nums' }} /></span></label>
      <Button block type="submit" loading={busy}>Confirm<ArrowRight size={18} aria-hidden="true" /></Button>
    </form>
  );

  if (state === 'loading') return <AuthCard tag="TWO-STEP SIGN-IN" title="One moment…"><p className="login-card-intro" role="status">Checking your account.</p></AuthCard>;

  if (state === 'failed') return (
    <AuthCard tag="TWO-STEP SIGN-IN" title="Couldn’t start two-step sign-in." intro="This is on our side, not yours. You can continue for now and set it up later from your profile.">
      {error && <div className="login-message is-error" role="alert">{error}</div>}
      <Button block onClick={() => router.replace(next)}>Continue to the portal<ArrowRight size={18} aria-hidden="true" /></Button>
    </AuthCard>
  );

  if (state === 'setup') return (
    <AuthCard tag="TWO-STEP SIGN-IN" title="Protect your account."
      intro="Board accounts can add members and see more, so they use a second step: a 6-digit code from an app on your phone.">
      {error && <div className="login-message is-error" role="alert">{error}</div>}
      <ol className="grid gap-s3 text-body-sm" style={{ paddingLeft: 18, margin: '4px 0 8px' }}>
        <li>Install an authenticator app, like <b>Google Authenticator</b> or <b>Microsoft Authenticator</b>.</li>
        <li>In the app, add an account and <b>scan this QR code</b>.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      {qr && <div style={{ display: 'grid', justifyItems: 'center', gap: 8, margin: '4px 0 12px' }}>
        <img src={qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: '#fff', padding: 10, borderRadius: 14 }} />
        <details className="text-caption text-ink-3"><summary style={{ cursor: 'pointer' }}>Can’t scan? Enter this key instead</summary><code style={{ wordBreak: 'break-all', userSelect: 'all' }}>{secret}</code></details>
      </div>}
      {codeField}
    </AuthCard>
  );

  return (
    <AuthCard tag="TWO-STEP SIGN-IN" title="Enter your code." intro={<><Smartphone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Open your authenticator app and type the 6-digit code for TEDxGUC.</>}>
      {error && <div className="login-message is-error" role="alert">{error}</div>}
      {codeField}
      <p className="login-invite-note">Lost your phone? Ask the Chairman to reset your login.</p>
    </AuthCard>
  );
}

export default function TwoStep() {
  return <Suspense fallback={<div className="login-loading" role="status">Loading…</div>}><TwoStepInner /></Suspense>;
}
