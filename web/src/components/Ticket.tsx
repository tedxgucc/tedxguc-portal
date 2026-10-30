'use client';
// The QR ticket (design system: QRTicket). The body is always white paper
// in both themes: it gets screenshotted and scanned, and scanners need
// dark-on-light.
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { fmtDate, fmtTime } from '@/lib/format';
import { LockupWhite } from './Brand';
import type { TicketPartner } from '@/lib/types';
import { assetUrl } from '@/lib/env';
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

export function Ticket({ eventTitle, eventKind, guestName, guestType, startsAt, venue, ticketNo, code, partners = [] }: {
  eventTitle: string; eventKind: string; guestName: string; guestType?: string; startsAt: string; venue: string | null; ticketNo: string; code: string; partners?: TicketPartner[];
}) {
  return (
    <div className="tx-ticket" id="ticket">
      <div className="tx-ticket__top">
        <LockupWhite height={18} />
        <div className="tx-ticket__event">{eventTitle}</div>
        <div className="caption" style={{ color: '#b8b8b8' }}>{eventKind}</div>
      </div>
      <div className="tx-ticket__perf" />
      <div className="tx-ticket__body">
        <div className="tx-ticket__grid">
          <div><div className="tx-ticket__k">Name</div><div className="tx-ticket__v">{guestName}</div></div>
            <div><div className="tx-ticket__k">Ticket type</div><div className="tx-ticket__v">{ticketTier(guestType)}</div></div>
          <div><div className="tx-ticket__k">Seat</div><div className="tx-ticket__v">Free seating</div></div>
          <div><div className="tx-ticket__k">Date</div><div className="tx-ticket__v">{fmtDate(startsAt)}</div></div>
          <div><div className="tx-ticket__k">Doors</div><div className="tx-ticket__v">{fmtTime(startsAt)}</div></div>
          {venue && <div style={{ gridColumn: '1 / -1' }}><div className="tx-ticket__k">Venue</div><div className="tx-ticket__v">{venue}</div></div>}
        </div>
        <QR value={code} label={`Ticket QR code ${ticketNo}`} />
        <div className="tx-ticket__code">{ticketNo}</div>
        {!!partners.length && <section aria-label="Event partners" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #dedbd7', textAlign: 'center' }}>
          <div className="tx-ticket__k" style={{ marginBottom: 14 }}>Powered by</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            {partners.map((p, i) => <img key={i} src={assetUrl(p.logo_url)} alt={p.name} crossOrigin="anonymous" style={{ width: 112, height: 56, objectFit: 'contain' }} /> /* eslint-disable-line @next/next/no-img-element */)}
          </div>
        </section>}
      </div>
      <div className="tx-ticket__bar" />
    </div>
  );
}
