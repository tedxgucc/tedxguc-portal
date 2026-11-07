'use client';
// While moving between portal pages: preload every menu page, and show a
// TEDx "X" that fills with red if the next page takes a moment to arrive.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BASE_PATH } from '@/lib/env';
import { useNav } from './PortalChrome';

export function NavLoading() {
  const path = usePathname();
  const router = useRouter();
  const groups = useNav();
  const [show, setShow] = useState(false);
  const timer = useRef<number | null>(null);

  // Preload the menu pages once the browser is idle, so clicks switch at once.
  useEffect(() => {
    const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    const run = () => hrefs.forEach((h) => { try { router.prefetch(h); } catch { /* ignore */ } });
    const t = setTimeout(run, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // A click on a link to another portal page starts the loader (after a short delay, to avoid flicker).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE_PATH}/portal`)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShow(true), 120);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // The new page has arrived: stop.
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setShow(false);
  }, [path]);
  // Never get stuck.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 15000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="tx-navload" role="status" aria-live="polite">
      <svg viewBox="0 0 100 100" width="76" height="76" aria-hidden="true">
        <defs>
          <clipPath id="tx-navload-x">
            <path d="M8 6h26l16 26 16-26h26L64 50l28 44H66L50 68 34 94H8l28-44z" />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="var(--surface-2)" clipPath="url(#tx-navload-x)" />
        <rect className="tx-navload__fill" x="0" y="0" width="100" height="100" fill="var(--accent)" clipPath="url(#tx-navload-x)" />
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  );
}
