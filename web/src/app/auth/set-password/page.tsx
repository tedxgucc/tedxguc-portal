'use client';
// After an invite or "choose a new password" link: pick the password. The
// Chairman and Curators then set up two-step sign-in.
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { needsTwoStep } from '@/lib/two-step';

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const first = params.get('first') === '1';
  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/portal') ? nextParam : '/portal';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  // This page only works right after the emailed link signed the person in.
  useEffect(() => {
    api.getMe().then((me) => {
      if (!me) router.replace('/login?reset=1');
      else setName(me.name.split(' ')[0]);
    }).catch(() => router.replace('/login?reset=1'));
  }, [router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setError('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setError('The two passwords don’t match.'); return; }
    setBusy(true); setError(null);
    try {
      await api.changePassword(pw);
      const me = await api.getMe();
      router.replace(me && needsTwoStep(me.role) ? `/auth/two-step?next=${encodeURIComponent(next)}` : next);
    } catch (x) { setError((x as Error).message); setBusy(false); }
  };

  return (
    <AuthCard tag={first ? 'WELCOME' : 'PASSWORD RESET'} title={first ? `Welcome${name ? `, ${name}` : ''}.` : 'Choose a new password.'}
      intro={first ? 'Choose the password you will use to sign in to the TEDxGUC portal.' : 'Pick a new password. You will use it from now on, on every device.'}>
      {error && <div className="login-message is-error" role="alert">{error}</div>}
      <form className="login-form" onSubmit={save} aria-busy={busy}>
        <label className="login-field"><span>New password</span><span className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" />
          <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required disabled={busy} />
          <button type="button" className="login-reveal" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        <label className="login-field"><span>Repeat it</span><span className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" />
          <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Same password again" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={8} required disabled={busy} /></span></label>
        <Button block type="submit" loading={busy}>{first ? 'Create my account' : 'Save new password'}<ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
    </AuthCard>
  );
}

export default function SetPassword() {
  return <Suspense fallback={<div className="login-loading" role="status">Loading…</div>}><SetPasswordInner /></Suspense>;
}
