'use client';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, EyeOff, Layers3, LockKeyhole, Mail, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { Lockup, PortalMark } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
import { Avatar, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { DEMO_COOKIE, demoPersonas, resetDemo } from '@/lib/api/demo-api';
import { clearCache } from '@/lib/cache';
import { DEMO, GOOGLE_LOGIN } from '@/lib/env';
import './login.css';

type Mode = 'signin' | 'setup' | 'reset';
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const requested = params.get('next');
  const next = requested && /^\/portal(?:\/|\?|#|$)/.test(requested) && !/[\\\r\n]/.test(requested) ? requested : '/portal';
  const [mode, setMode] = useState<Mode>(params.get('first') === '1' ? 'setup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get('error'));
  const changeMode = (value: Mode) => {
    if (inFlight.current) return;
    setMode(value); setError(null); setNotice(null); setPassword(''); setConfirm(''); setShowPassword(false); setCapsLock(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy('email'); setError(null); setNotice(null);
    try {
      if (mode === 'reset') {
        await api.sendPasswordReset(email.trim());
        setNotice('If this email has an account, a password-reset link is on its way. Check your inbox and spam folder.');
        return;
      }
      if (mode === 'setup') {
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        if (password !== confirm) throw new Error('The two passwords do not match.');
        if (!await api.signUpWithEmail(email.trim(), password)) {
          setNotice('Open the confirmation email we sent, then return here to sign in.'); return;
        }
      } else await api.signInWithEmail(email.trim(), password);
      clearCache(); router.replace(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { inFlight.current = false; setBusy(null); }
  };
  const google = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy('google'); setError(null);
    try { await api.signInWithGoogle(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect. Please try again.'); inFlight.current = false; setBusy(null); }
  };
  const pickDemo = (id: string) => {
    clearCache(); document.cookie = `${DEMO_COOKIE}=${id}; path=/; max-age=${60 * 60 * 8}; samesite=lax`; router.replace(next);
  };
  return (
    <div className="portal-login">
      <header className="login-header">
        <Link href="/" aria-label="TEDxGUC home"><Lockup height={24} /></Link>
        <div className="login-header-actions"><Link href="/" className="login-back"><ArrowLeft size={15} />Back to the site</Link><ThemeToggle /></div>
      </header>
      <main className="login-main">
        <section className="login-story" aria-labelledby="login-story-title">
          <div className="login-story-art" aria-hidden="true"><span /><span /></div>
          <div className="login-eyebrow"><span />THE TEAM BEHIND THE IDEAS</div>
          <h1 id="login-story-title">Big ideas.<br /><span>Built together.</span></h1>
          <p className="login-story-intro">The work starts here. Your people, your projects, and everything that brings TEDxGUC to life.</p>
          <div className="login-features">
            <div><Layers3 size={19} /><span>Make things happen<small>Keep projects and tasks moving.</small></span></div>
            <div><CalendarDays size={19} /><span>Stay in the loop<small>Find your next meeting or team event.</small></span></div>
            <div><Users size={19} /><span>One team, connected<small>Catch up on people and announcements.</small></span></div>
          </div>
          <div className="login-story-footer"><span>IDEAS WORTH SPREADING</span><span>TEDxGUC / TEAM PORTAL</span></div>
        </section>
        <section className="login-access" aria-labelledby="login-title">
          <div className="login-card">
            <div className="login-card-top"><PortalMark size={34} /><span><LockKeyhole size={12} />{DEMO ? 'DEMO ACCESS' : 'MEMBER ACCESS'}</span></div>
            <h2 id="login-title">{DEMO ? 'Meet your portal.' : mode === 'setup' ? 'Your journey starts here.' : mode === 'reset' ? 'Let\'s get you back in.' : 'Welcome back.'}</h2>
            <p className="login-card-intro">{DEMO ? 'Explore the team workspace. Choose a demo role to see it in action.' : mode === 'setup' ? 'Use the email your Chairman or Curator invited to set up your account.' : mode === 'reset' ? 'Enter your account email and we will send you a reset link.' : 'Sign in to your TEDxGUC team workspace.'}</p>
            {error && <div className="login-message is-error" role="alert">{error}</div>}
            {notice && <div className="login-message" role="status"><Check size={18} /><span>{notice}</span></div>}
            {DEMO ? <>
              <ul className="login-personas">{demoPersonas().map(p => <li key={p.user_id}><button onClick={() => pickDemo(p.user_id)}><Avatar name={p.member.name} /><span><strong>{p.label}</strong><small>{p.member.name} / {p.hint}</small></span><ArrowRight size={18} /></button></li>)}</ul>
              <button className="login-text-button login-demo-reset" onClick={() => { resetDemo(); toast('ok', 'Demo data reset.'); }}>Reset demo data</button>
            </> : <>
              {GOOGLE_LOGIN && mode === 'signin' && <>
                <Button block variant="secondary" onClick={google} loading={busy === 'google'} disabled={!!busy}><span className="login-google" aria-hidden="true">G</span>Continue with GUC Google</Button>
                <p className="login-provider-help">Use your GUC university account.</p>
                <div className="login-divider"><span />or use email<span /></div>
              </>}
              <form className="login-form" onSubmit={submit} aria-busy={!!busy}>
                <label className="login-field"><span>Email address</span><span className="login-input-wrap"><Mail size={18} aria-hidden="true" /><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!busy} /></span></label>
                {mode !== 'reset' && <>
                  <label className="login-field"><span className="login-field-heading">{mode === 'setup' ? 'Create a password' : 'Password'}</span><span className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} placeholder={mode === 'setup' ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))} onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} minLength={mode === 'setup' ? 8 : undefined} required disabled={!!busy} /><button type="button" className="login-reveal" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={!!busy}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
                  {capsLock && <p className="login-field-note" role="status">Caps Lock is on.</p>}
                  {mode === 'setup' && <label className="login-field"><span>Confirm password</span><span className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required disabled={!!busy} placeholder="Repeat your password" /></span></label>}
                  {mode === 'signin' && <button type="button" className="login-text-button login-forgot" disabled={!!busy} onClick={() => changeMode('reset')}>Forgot password?</button>}
                </>}
                <Button block type="submit" loading={busy === 'email'} disabled={!!busy}>{mode === 'setup' ? 'Create my account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}<ArrowRight size={18} aria-hidden="true" /></Button>
              </form>
              <div className="login-switch">{mode === 'signin' ? <>First time here? <button className="login-text-button" disabled={!!busy} onClick={() => changeMode('setup')}>Set up your account</button></> : <button className="login-text-button" disabled={!!busy} onClick={() => changeMode('signin')}><ArrowLeft size={14} />Back to sign in</button>}</div>
              <p className="login-invite-note"><LockKeyhole size={13} />Invite-only access. Need an invitation? Contact your Chairman or Curator.</p>
            </>}
          </div>
          <div className="login-help"><span>Need a hand?</span><Link href="/contact/">Get in touch<ArrowRight size={13} /></Link></div>
        </section>
      </main>
      <footer className="login-footer"><span>Independent ideas. Collective effort.</span><Link href="/privacy/">Privacy</Link></footer>
    </div>
  );
}
export default function LoginPage() {
  return <Suspense fallback={<div className="login-loading" role="status">Loading your workspace...</div>}><LoginInner /></Suspense>;
}
