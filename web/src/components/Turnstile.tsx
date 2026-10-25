'use client';
// Cloudflare Turnstile spam check on public forms (FR-1.9). Without a site
// key (local / demo) it renders nothing and the server skips the check.
import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/env';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    const el = ref.current;
    const render = () => {
      const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      window.turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, theme, callback: onToken });
    };
    if (window.turnstile) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [onToken]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} />;
}
