'use client';
// Lifecycle: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/env';
declare global { interface Window { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void }; } }
let scriptReady: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptReady) scriptReady = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    script.onload = () => { if (window.turnstile) resolve(); else { scriptReady = null; script.remove(); reject(new Error('Verification unavailable')); } };
    script.onerror = () => { scriptReady = null; script.remove(); reject(new Error('Verification unavailable')); };
    document.head.appendChild(script);
  });
  return scriptReady;
}
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken); callback.current = onToken;
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let alive = true, widget: string | undefined;
    const clearToken = () => { if (alive) callback.current(''); };
    callback.current(''); setError(false);
    loadScript().then(() => {
      if (!alive || !ref.current) return;
      widget = window.turnstile!.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY, theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
        callback: (token: string) => { if (alive) { setError(false); callback.current(token); } },
        'expired-callback': clearToken,
        'timeout-callback': clearToken,
        'error-callback': () => { if (alive) { clearToken(); setError(true); } },
      });
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [attempt, resetKey]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div><div ref={ref} />{error && <div className="grid gap-s2 mt-s2"><p className="text-body-sm" role="alert">Verification could not load. Check your connection or content blocker, then retry.</p><button className="tx-link justify-self-start" type="button" onClick={() => setAttempt((n) => n + 1)}>Retry verification</button></div>}</div>;
}
