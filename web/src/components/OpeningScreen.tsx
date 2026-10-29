'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LiquidMark } from './LiquidMark';

// Play once per visit on the homepage, landing on the real hero watermark.
export function OpeningScreen() {
  const [playing, setPlaying] = useState(true);
  const mark = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => {
    setPlaying(false);
    document.documentElement.classList.remove('intro-playing');
    document.documentElement.classList.add('intro-done');
    document.body.classList.remove('in-lock');
    try { sessionStorage.setItem('tx-intro-seen', '1'); } catch { /* Private browsing. */ }
  }, []);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('tx-intro-seen') === '1'; } catch { /* Private browsing. */ }
    if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    document.documentElement.classList.remove('intro-done');
    document.documentElement.classList.add('intro-playing');
    document.body.classList.add('in-lock');
    setPlaying(true);
    const timer = window.setTimeout(finish, 4600);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') finish(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', onKey);
      document.body.classList.remove('in-lock'); document.documentElement.classList.remove('intro-playing');
    };
  }, [finish]);
  useEffect(() => {
    if (!playing) return;
    const place = () => {
      const target = document.getElementById('home-watermark');
      const x = mark.current;
      if (!target || !x) return;
      const r = target.getBoundingClientRect();
      x.style.setProperty('--fx', (r.left + r.width / 2 - innerWidth / 2) + 'px');
      x.style.setProperty('--fy', (r.top + r.height / 2 - innerHeight / 2) + 'px');
      x.style.setProperty('--fs', String(r.height / (x.offsetHeight || 1)));
    };
    place(); window.addEventListener('resize', place);
    const observer = new ResizeObserver(place);
    const target = document.getElementById('home-watermark');
    if (target) observer.observe(target);
    return () => { window.removeEventListener('resize', place); observer.disconnect(); };
  }, [playing]);
  if (!playing) return null;
  return <div className="in" aria-label="TEDxGUC introduction">
    <div className="in__bg" aria-hidden="true" />
    <div className="in__x" ref={mark} aria-hidden="true"><LiquidMark /></div>
    <button className="hm__intro-skip" onClick={finish} type="button">Skip intro</button>
  </div>;
}
