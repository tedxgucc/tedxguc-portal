'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LockupWhite, TedxMark } from './Brand';

// Spotlight entrance adapted from the supplied home-page design.
export function OpeningScreen({ portal = false }: { portal?: boolean }) {
  const [playing, setPlaying] = useState(true);
  const scrollLock = useRef<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const sessionKey = portal ? 'tx-portal-intro-seen' : 'tx-intro-seen';
  const finish = useCallback(() => {
    setPlaying(false);
    if (scrollLock.current !== null) { document.body.style.overflow = scrollLock.current; scrollLock.current = null; }
    delete document.documentElement.dataset.introMode;
    delete document.documentElement.dataset.introStarted;
    document.documentElement.classList.remove('intro-playing');
    document.documentElement.classList.add('intro-done');
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Storage unavailable. */ }
  }, [sessionKey]);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let seen = false;
    try { seen = sessionStorage.getItem(sessionKey) === '1'; } catch { /* Storage unavailable. */ }
    if (seen || motion.matches) { finish(); return; }
    const root = document.documentElement;
    const mode = portal ? 'portal' : 'site';
    const alreadyStarted = root.dataset.introMode === mode;
    const started = alreadyStarted ? Number(root.dataset.introStarted) : performance.now();
    root.dataset.introMode = mode;
    root.dataset.introStarted = String(started);
    setPlaying(true);
    document.documentElement.classList.remove('intro-done');
    document.documentElement.classList.add('intro-playing');
    scrollLock.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(finish, Math.max(0, 2800 - (performance.now() - started)));
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') finish(); };
    const reduce = () => { if (motion.matches) finish(); };
    document.addEventListener('keydown', key);
    motion.addEventListener('change', reduce);
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', key); motion.removeEventListener('change', reduce);
      if (scrollLock.current !== null) { document.body.style.overflow = scrollLock.current; scrollLock.current = null; }
      document.documentElement.classList.remove('intro-playing');
    };
  }, [finish, sessionKey, portal]);
  useEffect(() => {
    if (!playing) return;
    const position = () => {
      const target = portal ? overlay.current?.querySelector('.spotlight-portal-mark') : document.getElementById('home-watermark');
      const box = target?.getBoundingClientRect();
      overlay.current?.style.setProperty('--wx', (box ? box.left + box.width / 2 : innerWidth / 2) + 'px');
      overlay.current?.style.setProperty('--wy', (box ? box.top + box.height / 2 : innerHeight / 2) + 'px');
      overlay.current?.style.setProperty('--wh', (box?.height ?? 180) + 'px');
    };
    position(); window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [playing, portal]);
  if (!playing) return null;
  return <div className={'spotlight-intro' + (portal ? ' is-portal' : '')} ref={overlay} aria-label={portal ? 'TEDxGUC portal introduction' : 'TEDxGUC introduction'}>
    {portal && <div className="spotlight-portal"><div className="spotlight-portal-mark"><TedxMark size={150} /></div><LockupWhite height={28} /><span>TEAM PORTAL</span></div>}
    <div className="spotlight-dark" aria-hidden="true" />
  </div>;
}

export function SiteEntrance() {
  const path = usePathname().replace(/\/+$/, '') || '/';
  const portal = path === '/login' || path === '/portal' || path.startsWith('/portal/');
  if (path !== '/' && !portal) return null;
  return <OpeningScreen key={portal ? 'portal' : 'site'} portal={portal} />;
}
