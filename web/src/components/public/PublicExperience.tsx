'use client';
import { ArrowUp, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
export function PublicExperience() {
  const progress = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (progress.current) progress.current.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0) + ')';
      setShowTop(scrollY > 640);
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const network = () => setOffline(!navigator.onLine);
    update(); network();
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll);
    window.addEventListener('online', network); window.addEventListener('offline', network);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); window.removeEventListener('online', network); window.removeEventListener('offline', network); };
  }, []);
  return <>
    <div className="public-progress" ref={progress} aria-hidden="true" />
    {offline && <div className="public-offline" role="status"><WifiOff size={16} aria-hidden="true" />You are offline. Forms need a connection.</div>}
    {showTop && <button className="public-back-top" type="button" aria-label="Back to top" onClick={() => { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); document.getElementById('main')?.focus({ preventScroll: true }); }}><ArrowUp size={20} aria-hidden="true" /></button>}
  </>;
}
