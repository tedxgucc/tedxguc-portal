'use client';
// Main sponsor discount banner (FR-18.6, design system: SponsorBanner).
// A slim strip above the public nav, one sponsor per slide; rotates every
// 6 s, pauses on hover or focus, stops with reduced motion, and can be
// closed for this visit. Clicks are counted per sponsor per day.
import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { xaccessApi, type XPartner } from '@/lib/api/xaccess';
import { assetUrl } from '@/lib/env';

const HIDE = 'tx-sponsor-hidden';

export function SponsorBanner() {
  const [list, setList] = useState<XPartner[]>([]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { if (sessionStorage.getItem(HIDE)) return; } catch { /* ignore */ }
    setHidden(false);
    xaccessApi.listBanner().then(setList).catch(() => {});
  }, []);
  useEffect(() => {
    if (paused || list.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setAt((i) => (i + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [paused, list.length]);
  if (hidden || !list.length) return null;
  const p = list[at % list.length];
  const close = () => { setHidden(true); try { sessionStorage.setItem(HIDE, '1'); } catch { /* ignore */ } };
  const click = () => { xaccessApi.bannerClick(p.id).catch(() => {}); };
  const inner = (
    <>
      <span className="tx-sponsor__logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.logo_url ? <img src={assetUrl(p.logo_url)} alt={p.name} style={{ maxHeight: 22, maxWidth: 80, objectFit: 'contain' }} /> : p.name.slice(0, 12).toUpperCase()}
      </span>
      {p.banner_offer && <span className="tx-sponsor__off">{p.banner_offer}</span>}
      <span className="min-w-0 truncate hidden sm:inline">{p.perk}</span>
      {p.promo_code && <span className="tx-sponsor__code">{p.promo_code}</span>}
    </>
  );
  return (
    <div className="tx-sponsor" role="region" aria-label="Sponsor offers" aria-live="polite"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {p.website
        ? <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={click} className="flex items-center gap-s3 min-w-0 no-underline text-ink">{inner}</a>
        : <Link href="/perks" onClick={click} className="flex items-center gap-s3 min-w-0 no-underline text-ink">{inner}</Link>}
      <span className="tx-sponsor__dots" aria-hidden="true">{list.map((x, i) => <i key={x.id} className={i === at % list.length ? 'on' : ''} />)}</span>
      <button type="button" onClick={close} className="bg-transparent border-0 cursor-pointer text-ink-3 grid place-items-center p-s1" aria-label="Hide sponsor offers"><X size={16} /></button>
    </div>
  );
}
