'use client';
// X Access card (design system: XAccessCard) and the perks list.
// Front: the official artwork, never redrawn. Back: name, tier, expiry and
// the QR partners scan (it opens the verify page).
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QR } from '@/components/Ticket';
import { Chip } from '@/components/ui';
import type { XCardState, XPartner } from '@/lib/api/xaccess';
import { assetUrl, BASE_PATH } from '@/lib/env';
import { fmtDate } from '@/lib/format';

export const verifyUrl = (code: string) => `${typeof window === 'undefined' ? '' : window.location.origin}${BASE_PATH}/xaccess/verify/?c=${encodeURIComponent(code)}`;
export const cardUrl = (code: string) => `${typeof window === 'undefined' ? '' : window.location.origin}${BASE_PATH}/xaccess/card/?c=${encodeURIComponent(code)}`;

type CardInfo = { number: string; holder_name: string; tier: string; expires_on: string; status: XCardState };

export function XCardFront() {
  return (
    <div className="tx-xcard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tx-xcard__art" src={`${BASE_PATH}/brand/x-access-card-front.png`} alt="X Access card" />
    </div>
  );
}

export function XCardBack({ card, code }: { card: CardInfo; code: string }) {
  return (
    <div className="tx-xcard tx-xcard--back">
      <span className="tx-xcard__brand">X Access</span>
      <span className="tx-xcard__meta">{card.tier} · {card.number}<br />Valid until {fmtDate(`${card.expires_on}T12:00:00Z`, { year: true })}</span>
      <span className="tx-xcard__name">{card.holder_name}</span>
      <div className="tx-xcard__qr"><QR className="w-full h-full [&_svg]:w-full [&_svg]:h-full" value={verifyUrl(code)} label={`X Access card ${card.number}`} /></div>
    </div>
  );
}

export function CardState({ status }: { status: XCardState }) {
  if (status === 'valid') return <Chip kind="ok">Valid</Chip>;
  if (status === 'expired') return <Chip kind="pending">Expired</Chip>;
  if (status === 'cancelled') return <Chip kind="void">Cancelled</Chip>;
  return <Chip kind="bad">Not found</Chip>;
}

// "Show my card": the back, full screen, on white, for partners to scan.
export function ShowCard({ card, code, onClose }: { card: CardInfo; code: string; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-modal grid place-items-center p-s4" style={{ background: '#fff' }} role="dialog" aria-modal="true" aria-label="My X Access card">
      <button type="button" onClick={onClose} className="absolute top-s4 right-s4 tx-iconbtn" style={{ color: '#000' }} aria-label="Close"><X /></button>
      <div className="w-full max-w-[520px] grid gap-s4 justify-items-center">
        <div className="w-full [&_.tx-xcard]:max-w-none"><XCardBack card={card} code={code} /></div>
        <p className="text-body-sm text-center" style={{ color: '#000' }}>Show this to the partner. They scan the QR to check it.</p>
      </div>
    </div>,
    document.body,
  );
}

export function CardPair({ card, code, onShow }: { card: CardInfo; code: string; onShow?: () => void }) {
  return (
    <div className="grid gap-s3">
      <div className="tx-xpair"><XCardFront /><XCardBack card={card} code={code} /></div>
      {onShow && (
        <button type="button" onClick={onShow} className="tx-btn tx-btn--primary justify-self-start">
          <Maximize2 aria-hidden="true" />Show my card
        </button>
      )}
    </div>
  );
}

export function PerkList({ perks }: { perks: XPartner[] }) {
  return (
    <ul className="grid gap-s3 sm:grid-cols-2 lg:grid-cols-3">
      {perks.map((p) => (
        <li key={p.id} className="tx-card grid gap-s3 content-start">
          <div className="flex items-center gap-s3 min-w-0">
            <span className="tx-sponsor__logo shrink-0" style={{ height: 44, minWidth: 72 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.logo_url ? <img src={assetUrl(p.logo_url)} alt="" style={{ maxHeight: 36, maxWidth: 96, objectFit: 'contain' }} /> : p.name.slice(0, 10).toUpperCase()}
            </span>
            <span className="font-semibold min-w-0 truncate">{p.name}</span>
          </div>
          <p className="h4">{p.perk}</p>
          {p.terms && <p className="text-caption text-ink-3">{p.terms}</p>}
          {p.promo_code && <p className="text-body-sm">Code: <span className="code select-all font-semibold">{p.promo_code}</span></p>}
          <div className="flex flex-wrap items-center gap-s3 text-caption text-ink-3">
            {p.expires_on && <span>Until {fmtDate(`${p.expires_on}T12:00:00Z`, { year: true })}</span>}
            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="tx-link inline-flex items-center gap-s1">Website<ExternalLink size={12} aria-hidden="true" /></a>}
          </div>
        </li>
      ))}
    </ul>
  );
}
