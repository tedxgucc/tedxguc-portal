'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BASE_PATH } from '@/lib/env';

const VISITED = 'tx-opening-seen-v1';

export function OpeningScreen({ title, label, detail, description }: {
  title: string; label: string; detail?: string; description: string;
}) {
  const [visible, setVisible] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const enter = () => {
    try { sessionStorage.setItem(VISITED, '1'); } catch { /* Continue without storage. */ }
    setVisible(false);
  };

  useEffect(() => {
    try { if (sessionStorage.getItem(VISITED)) return; } catch { /* Still allow entry. */ }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!visible) return null;
  const words = title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;

  return createPortal(
    <dialog ref={dialog} className="op" aria-labelledby="opening-title" onCancel={enter}>
      <svg className="op__svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="op__t op__t--a" d="M 18 -76 C 73 8, 128 91, 183 175 C 239 258, 294 342, 382 476" />
        <path className="op__t op__t--b" d="M 382 -76 C 327 8, 272 91, 217 175 C 161 258, 106 342, 18 476" />
        <g className="op__x"><g className="op__k"><path className="op__glyph" transform="translate(130.37 136.36) scale(0.7487)" d="M7 0 L64 83 L5 170 L68 170 L93 128 L118 170 L181 170 L122 83 L179 0 L116 0 L93 39 L70 0 Z" /></g></g>
        <circle className="op__ring" cx="200" cy="200" r="16" />
      </svg>
      <div className="op__dots" aria-hidden="true" />
      <div className="op__content op__top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="op__lock" src={`${BASE_PATH}/brand/tedxguc-lockup-white.png`} alt="TEDxGUC" />
        <button type="button" className="op__skip" onClick={enter} autoFocus>Skip intro</button>
      </div>
      <div className="op__content op__main">
        <div className="op__label">{label}{detail && <b> · {detail}</b>}</div>
        <h1 id="opening-title" className="op__title">{words.join(' ')}{last && <> <span>{last}</span></>}</h1>
        <p className="op__sub">{description}</p>
        <div className="op__links">
          <button type="button" className="op__cta" onClick={enter}>Enter <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          <span className="op__since">TEDxGUC · since 2013</span>
        </div>
      </div>
      <div className="op__bar" aria-hidden="true" />
    </dialog>,
    document.body,
  );
}
