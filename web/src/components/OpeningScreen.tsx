'use client';
// TEDxGUC opening, "Loose Ends" (design system: opening/). Two red threads pull
// taut into the TEDx "x", the x grows into the watermark and the logo appears.
// It plays on every page load or refresh of the public site (it lives in the
// public layout, so moving between pages inside the site doesn't replay it).
// It is part of the page itself, so it shows from the very first frame.
// Skip: the link, a click or tap anywhere, Enter or Esc.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_PATH } from '@/lib/env';

const LENGTH_MS = 4200;

export function OpeningScreen() {
  const [state, setState] = useState<'on' | 'leaving' | 'gone'>('on');
  const done = useRef(false);

  const leave = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setState('leaving');
    window.setTimeout(() => setState('gone'), 500);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(leave, reduce ? 1200 : LENGTH_MS);
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') leave(); };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [leave]);
  useEffect(() => { if (state !== 'on') document.body.style.overflow = ''; }, [state]);

  if (state === 'gone') return null;
  return (
    <div className={`op${state === 'leaving' ? ' is-leaving' : ''}`} role="presentation" onClick={leave} aria-hidden={state === 'leaving'}>
      <svg className="op__svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="op__t op__t--a" d="M 18 -76 C 73 8, 128 91, 183 175 C 239 258, 294 342, 382 476" />
        <path className="op__t op__t--b" d="M 382 -76 C 327 8, 272 91, 217 175 C 161 258, 106 342, 18 476" />
        <g className="op__x"><g className="op__k"><path className="op__glyph" transform="translate(130.37 136.36) scale(0.7487)" d="M7 0 L64 83 L5 170 L68 170 L93 128 L118 170 L181 170 L122 83 L179 0 L116 0 L93 39 L70 0 Z" /></g></g>
        <circle className="op__ring" cx="200" cy="200" r="16" />
      </svg>
      <div className="op__dots" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="op__center"><img className="op__logo" src={`${BASE_PATH}/brand/tedxguc-lockup-white.png`} alt="TEDxGUC" /></div>
      <div className="op__content op__top">
        <span />
        <button type="button" className="op__skip bg-transparent border-0 cursor-pointer p-s2" onClick={(e) => { e.stopPropagation(); leave(); }}>Skip</button>
      </div>
      <div className="op__bar" aria-hidden="true" />
    </div>
  );
}
