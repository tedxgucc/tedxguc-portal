'use client';
// Every account email link lands here: invites, "choose a new password" and
// email changes. The link carries a one-time token; it is used only when the
// person taps Continue, so email apps that pre-open links can't spend it, and it
// works in any browser (the Gmail app included).
import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import type { EmailLinkType } from '@/lib/api/types';
import { clearCache } from '@/lib/cache';

const TYPES: EmailLinkType[] = ['invite', 'recovery', 'email_change', 'signup', 'magiclink', 'email'];
const COPY: Record<string, { tag: string; title: string; intro: string; button: string }> = {
  invite: { tag: 'PORTAL INVITE', title: "You're on the team.", intro: 'Tap Continue, then choose the password you will use to sign in.', button: 'Continue' },
  recovery: { tag: 'PASSWORD RESET', title: 'Choose a new password.', intro: 'Tap Continue, then choose a new password.', button: 'Continue' },
  email_change: { tag: 'EMAIL CHANGE', title: 'Confirm your new email.', intro: 'Tap Continue to switch your portal account to this email.', button: 'Confirm my new email' },
  default: { tag: 'MEMBER ACCESS', title: 'Almost there.', intro: 'Tap Continue to finish signing in.', button: 'Continue' },
};

function ConfirmInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tokenHash = params.get('token_hash') ?? '';
  const raw = params.get('type') ?? '';
  const type = (TYPES as string[]).includes(raw) ? (raw as EmailLinkType) : null;
  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/portal';
  const copy = COPY[type ?? ''] ?? COPY.default;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(!tokenHash || !type ? 'This link is incomplete. Ask for a new one below.' : null);
  const [done, setDone] = useState(false);

  const go = async () => {
    if (!type) return;
    setBusy(true); setError(null);
    try {
      await api.verifyEmailLink(tokenHash, type);
      clearCache();
      if (type === 'email_change') { setDone(true); return; }
      router.replace(type === 'invite' || type === 'recovery' ? `/auth/set-password?next=${encodeURIComponent(next === '/auth/set-password' ? '/portal' : next)}&first=${type === 'invite' ? 1 : 0}` : next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (done) return (
    <AuthCard tag="EMAIL CHANGE" title="Email confirmed." intro="Your portal account now uses this email. Sign in with it from now on.">
      <Link href="/portal" className="tx-btn tx-btn--primary" style={{ width: '100%' }}>Open the portal<ArrowRight size={18} aria-hidden="true" /></Link>
    </AuthCard>
  );

  return (
    <AuthCard tag={copy.tag} title={copy.title} intro={copy.intro}>
      {error ? <>
        <div className="login-message is-error" role="alert">{error}</div>
        <Link href="/login?reset=1" className="tx-btn tx-btn--primary" style={{ width: '100%' }}>Send me a new link<ArrowRight size={18} aria-hidden="true" /></Link>
        <p className="login-invite-note">Links work once and expire after a while. Asking for a new one is always safe.</p>
      </> : <>
        <Button block onClick={go} loading={busy}>{copy.button}<ArrowRight size={18} aria-hidden="true" /></Button>
        <p className="login-invite-note"><Check size={13} />This works on any device or browser, including the Gmail app.</p>
      </>}
    </AuthCard>
  );
}

export default function AuthConfirm() {
  return <Suspense fallback={<div className="login-loading" role="status">Loading…</div>}><ConfirmInner /></Suspense>;
}
