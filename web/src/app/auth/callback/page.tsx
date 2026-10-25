'use client';
// Google sign-in and password-reset links land here. The browser swaps the
// one-time code for a session, then goes on to the portal.
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { db } from '@/lib/supabase';

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const next = params.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/portal';
    const fail = (msg: string) => router.replace(`/login?error=${encodeURIComponent(msg)}`);
    // The sign-up hook's refusal ("invite-only", "use your GUC email") comes back here.
    const err = params.get('error_description');
    if (err) { fail(err); return; }
    const code = params.get('code');
    if (!code) { fail('That sign-in link is incomplete. Try again.'); return; }
    db().auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) fail('That sign-in link expired. Try again.');
      else router.replace(safeNext);
    });
  }, [params, router]);
  return <p className="p-s6 text-ink-2" role="status">Signing you in…</p>;
}

export default function AuthCallback() {
  return <Suspense><CallbackInner /></Suspense>;
}
