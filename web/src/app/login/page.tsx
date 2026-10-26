'use client';
// Portal login (FR-2.1): Google with a GUC account, or email + password.
// Demo mode shows a role picker instead. Ends with the red bottom bar.
import { ArrowRight, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Lockup, PortalMark, TxLabel } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
import { Avatar, Button, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { DEMO_COOKIE, demoPersonas, resetDemo } from '@/lib/api/demo-api';
import { clearCache } from '@/lib/cache';
import { DEMO, GOOGLE_LOGIN } from '@/lib/env';

function safeNext(next: string | null) {
  return next && next.startsWith('/portal') ? next : '/portal';
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = safeNext(params.get('next'));
  const urlError = params.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | 'reset' | null>(null);
  // First time: invited people set their own password (no email needed).
  const [firstTime, setFirstTime] = useState(params.get('first') === '1');
  const [password2, setPassword2] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(urlError);

  const google = async () => {
    setBusy('google');
    try { await api.signInWithGoogle(); } catch (e) { setError((e as Error).message); setBusy(null); }
  };
  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    setError(null);
    try {
      if (firstTime) {
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        if (password !== password2) throw new Error('The two passwords don’t match.');
        const ready = await api.signUpWithEmail(email.trim(), password);
        if (!ready) { setNotice('Almost there: open the confirmation email we sent, then log in.'); setBusy(null); return; }
      } else {
        await api.signInWithEmail(email.trim(), password);
      }
      clearCache();
      router.replace(next);
    } catch (x) {
      setError((x as Error).message);
      setBusy(null);
    }
  };
  const reset = async () => {
    if (!email.trim()) { setError('Enter your email first, then tap “Forgot password?”.'); return; }
    setBusy('reset');
    await api.sendPasswordReset(email.trim()).catch(() => {});
    toast('ok', 'Check your inbox.', 'If this email has an account, a reset link is on its way.');
    setBusy(null);
  };
  const pickDemo = (userId: string) => {
    clearCache();
    document.cookie = `${DEMO_COOKIE}=${userId}; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
    router.replace(next);
  };

  return (
    <div className="min-h-dvh grid grid-rows-[auto_1fr_auto]">
      <header className="flex items-center justify-between px-s4 md:px-s6 h-[64px] border-b border-line">
        <Link href="/" aria-label="TEDxGUC home"><Lockup height={22} /></Link>
        <ThemeToggle />
      </header>
      <main className="tx-watermark is-hero grid place-items-center px-s4 py-s7">
        <div className="w-full max-w-[420px] grid gap-s5 tx-page">
          <div className="grid gap-s3">
            <PortalMark size={40} />
            <TxLabel>Team portal</TxLabel>
            <h1 className="h1 uppercase">{firstTime ? 'Set your password' : 'Log in'}</h1>
            {firstTime && <p className="text-ink-2">Use the email your Chairman or Curator invited.</p>}
          </div>

          {error && (
            <div className="tx-toast tx-toast--bad" role="alert" style={{ boxShadow: 'none', maxWidth: 'none' }}>
              <span aria-hidden="true" className="font-display text-h4 text-bad">!</span>
              <div><div className="tx-toast__t">We couldn’t log you in.</div><div className="tx-toast__d">{error}</div></div>
              <span />
            </div>
          )}

          {DEMO ? (
            <section className="grid gap-s3" aria-labelledby="demo">
              <p id="demo" className="text-ink-2">Demo mode: pick who you want to be. Each role sees what the permissions matrix allows.</p>
              <ul className="grid gap-s2">
                {demoPersonas().map((p) => (
                  <li key={p.user_id}>
                    <button onClick={() => pickDemo(p.user_id)} className="tx-card w-full text-left flex items-center gap-s3 hover:bg-surface-2" style={{ padding: 12 }}>
                      <Avatar name={p.member.name} />
                      <span className="grid grid-cols-1 flex-1 min-w-0">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-caption text-ink-3 truncate">{p.member.name} · {p.hint}</span>
                      </span>
                      <ArrowRight size={20} className="text-ink-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button className="tx-link text-body-sm justify-self-start bg-transparent border-0 cursor-pointer" onClick={() => { resetDemo(); toast('ok', 'Demo data reset.'); }}>
                Reset demo data
              </button>
            </section>
          ) : (
            <>
              {notice && <div className="tx-card text-body-sm" role="status">{notice}</div>}
              {GOOGLE_LOGIN && !firstTime && (
                <>
                  <Button block variant="primary" onClick={google} loading={busy === 'google'}>
                    <LogIn aria-hidden="true" />Continue with GUC Google
                  </Button>
                  <p className="text-caption text-ink-3 -mt-s3">Use your @student.guc.edu.eg or @guc.edu.eg account.</p>
                  <div className="flex items-center gap-s3 text-caption text-ink-3" aria-hidden="true">
                    <span className="flex-1 h-px bg-line" />or<span className="flex-1 h-px bg-line" />
                  </div>
                </>
              )}
              <form className="grid gap-s4" onSubmit={withEmail}>
                <TextInput label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <TextInput label={firstTime ? 'New password' : 'Password'} type="password" autoComplete={firstTime ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required help={firstTime ? 'At least 8 characters.' : undefined} />
                {firstTime && <TextInput label="Repeat password" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />}
                <Button type="submit" block variant={GOOGLE_LOGIN && !firstTime ? 'secondary' : 'primary'} loading={busy === 'email'}>{firstTime ? 'Create my account' : 'Log in'}</Button>
                {!firstTime && <button type="button" onClick={reset} className="tx-link text-body-sm justify-self-start bg-transparent border-0 cursor-pointer">Forgot password?</button>}
              </form>
              <p className="text-body-sm text-ink-3">{firstTime ? 'Already set your password? ' : 'First time here? '}
                <button type="button" className="tx-link bg-transparent border-0 cursor-pointer p-0" onClick={() => { setFirstTime(!firstTime); setError(null); setNotice(null); }}>{firstTime ? 'Log in' : 'Set your password'}</button>
                {firstTime ? '' : '. The portal is invite-only: ask your Chairman or Curator to add your email first.'}</p>
            </>
          )}
        </div>
      </main>
      <div className="tx-bottombar" />
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
