'use client';
/* eslint-disable @next/next/no-img-element */
// The QR ticket ("Your place around the dot"): a plan of the stage seen from above.
// The red dot is the stage, the audience sits in rings around it, and a red x
// (the x from the TEDx logo) marks one seat picked by the ticket number.
// The details and QR sit on paper below; scanners need dark-on-light, so the QR is always on white.
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate, fmtTime } from '@/lib/format';
import type { TicketPartner } from '@/lib/types';
import { assetUrl, BASE_PATH } from '@/lib/env';
import { ticketTier } from '@/lib/event-registration';

export function QR({ value, label, className = 'tx-ticket__qr' }: { value: string; label: string; className?: string }) {
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [value]);
  return <div className={className} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Outline of the x in the TEDx logo (176 x 170 units).
const XPTS: [number, number][] = [[2, 0], [59, 83], [0, 170], [63, 170], [88, 128], [113, 170], [176, 170], [117, 83], [174, 0], [111, 0], [88, 39], [65, 0]];
const CX = 170, CY = 176, R = 96, RINGS = [120, 136, 152, 168, 184, 200, 216];

// Every seat around the dot, grouped by ring (each ring animates as one group, so it stays light on phones).
function stagePlan(ticketNo: string) {
  type Seat = { x: number; y: number; ri: number };
  const seats: Seat[] = [];
  RINGS.forEach((r, ri) => {
    const n = Math.floor((2 * Math.PI * r) / 13.5);
    for (let i = 0; i < n; i++) { const a = ((i + (ri % 2) * 0.5) / n) * 2 * Math.PI; seats.push({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), ri }); }
  });
  // Keep clear of the logo and the tier pill; the x only lands where it is fully visible.
  const hidden = (s: Seat) => s.y < 52 && (s.x < 150 || s.x > 232);
  const ok = seats.filter((s) => !hidden(s) && s.x > 46 && s.x < 294 && s.y > 66 && s.y < 306 && s.ri < 3);
  const num = parseInt(ticketNo.replace(/\D/g, ''), 10) || 1;
  const you = ok[(num * 7919) % ok.length];
  const rings = RINGS.map((_, ri) => seats.filter((s) => s.ri === ri && s !== you && !hidden(s)));
  const k = 15 / 170;
  const xPoints = XPTS.map(([px, py]) => `${((px - 88) * k + you.x).toFixed(2)},${((py - 85) * k + you.y).toFixed(2)}`).join(' ');
  return { you, rings, xPoints };
}

export function Ticket({ eventTitle, eventKind, guestName, guestType, startsAt, venue, ticketNo, code, partners = [] }: {
  eventTitle: string; eventKind: string; guestName: string; guestType?: string; startsAt: string; venue: string | null; ticketNo: string; code: string; partners?: TicketPartner[];
}) {
  const vip = ticketTier(guestType) === 'VIP';
  const tier = vip ? 'VIP' : 'Guest';
  const plan = useMemo(() => stagePlan(ticketNo), [ticketNo]);
  const date = fmtDate(startsAt), doors = fmtTime(startsAt);
  const ringText = `IDEAS WORTH SPREADING • ${eventTitle.toUpperCase()} • ${date.toUpperCase()} • `;
  const titleSize = eventTitle.length > 11 ? 21 : eventTitle.length > 8 ? 25 : 31;
  const ringR = R - 11;
  const el = useRef<HTMLDivElement>(null);

  // Gentle tilt towards the pointer (mouse only; transform only, so it stays smooth).
  useEffect(() => {
    const tk = el.current; if (!tk) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let raf = 0, rx = 0, ry = 0, fx = 50;
    const apply = () => { raf = 0; tk.style.setProperty('--rx', `${rx.toFixed(2)}deg`); tk.style.setProperty('--ry', `${ry.toFixed(2)}deg`); tk.style.setProperty('--fx', `${fx.toFixed(1)}%`); };
    const move = (e: PointerEvent) => { const r = tk.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      ry = x * 13; rx = -y * 9; fx = 100 - (x + 0.5) * 100; tk.classList.add('is-live'); if (!raf) raf = requestAnimationFrame(apply); };
    const leave = () => { tk.classList.remove('is-live'); rx = 0; ry = 0; if (!raf) raf = requestAnimationFrame(apply); };
    tk.addEventListener('pointermove', move); tk.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(raf); tk.removeEventListener('pointermove', move); tk.removeEventListener('pointerleave', leave); };
  }, []);

  const ringId = `tk-ring-${ticketNo.replace(/\W/g, '')}`;
  return (
    <div className={'tk tk--play' + (vip ? ' tk--vip' : '')} id="ticket" ref={el}>
      <div className="tk__stage">
        <svg viewBox="0 0 340 340" aria-hidden="true">
          {plan.rings.map((ring, ri) => <g key={ri} className="tk__ring" style={{ ['--r' as string]: ri }}>
            {ring.map((s, i) => <circle key={i} className="tk__seat" cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r="2.3" />)}
          </g>)}
          <circle className="tk__dot" cx={CX} cy={CY} r={R} />
          <defs><path id={ringId} d={`M${CX} ${CY} m-${ringR} 0 a${ringR} ${ringR} 0 1 1 ${2 * ringR} 0 a${ringR} ${ringR} 0 1 1 -${2 * ringR} 0`} /></defs>
          <g className="tk__spin"><text className="tk__ringtext"><textPath href={`#${ringId}`} textLength={(2 * Math.PI * ringR - 6).toFixed(0)}>{ringText}</textPath></text></g>
          <circle className="tk__you-ring" cx={plan.you.x.toFixed(1)} cy={plan.you.y.toFixed(1)} r="9" />
          <circle className="tk__pad" cx={plan.you.x.toFixed(1)} cy={plan.you.y.toFixed(1)} r="10.5" />
          <polygon className="tk__x" points={plan.xPoints} />
        </svg>
        <img className="tk__lock" src={`${BASE_PATH}/brand/tedxguc-lockup-${vip ? 'white' : 'black'}.png`} alt="TEDxGUC" />
        <span className="tk__tier">{tier}</span>
        <div className="tk__on">
          <div className="tk__kind">{eventKind}</div>
          <div className="tk__title" style={{ fontSize: titleSize }}>{eventTitle}</div>
          <div className="tk__when">{date} · doors {doors}</div>
        </div>
        <span className="tk__youlab" style={{ left: `${((plan.you.x / 340) * 100).toFixed(2)}%`, top: `${((plan.you.y / 340) * 100).toFixed(2)}%` }}>You</span>
      </div>
      <div className="tk__perf" />
      <div className="tk__body">
        <div><div className="tk__k">Admit one</div><div className="tk__name">{guestName}</div></div>
        <div className="tk__grid">
          <div><div className="tk__k">Date</div><div className="tk__v">{date}</div></div>
          <div><div className="tk__k">Doors</div><div className="tk__v">{doors}</div></div>
          <div><div className="tk__k">Seat</div><div className="tk__v">Free seating</div></div>
          {venue && <div style={{ gridColumn: '1 / -1' }}><div className="tk__k">Venue</div><div className="tk__v">{venue}</div></div>}
        </div>
        <div className="tk__scan">
          <QR value={code} label={`Ticket QR code ${ticketNo}`} className="tx-ticket__qr tk__qr" />
          <div><div className="tk__k">Ticket</div><div className="tk__no">{ticketNo}</div>
            <div className="tk__legend"><span><i className="ld" />The red dot: the stage</span><span><i className="lx" />The x: your place</span></div></div>
        </div>
        {!!partners.length && <section aria-label="Event partners" className="tk__partners">
          <div className="tk__k">Powered by</div>
          <div className="tk__logos">{partners.map((p, i) => <img key={i} src={assetUrl(p.logo_url)} alt={p.name} crossOrigin="anonymous" />)}</div>
        </section>}
      </div>
      <div className="tk__foot"><span>Ideas worth spreading</span><span>{tier}</span></div>
      <div className="tk__foil" aria-hidden="true" />
    </div>
  );
}
