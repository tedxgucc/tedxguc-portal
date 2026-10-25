'use client';
// The QR ticket (design system: QRTicket). The body is always white paper
// in both themes: it gets screenshotted and scanned, and scanners need
// dark-on-light.
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { fmtDate, fmtTime } from '@/lib/format';
import { LockupWhite } from './Brand';

export function QR({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [value]);
  return <div className="tx-ticket__qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Ticket({ eventTitle, eventKind, guestName, startsAt, venue, ticketNo, code }: {
  eventTitle: string; eventKind: string; guestName: string; startsAt: string; venue: string | null; ticketNo: string; code: string;
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
          <div><div className="tx-ticket__k">Seat</div><div className="tx-ticket__v">Free seating</div></div>
          <div><div className="tx-ticket__k">Date</div><div className="tx-ticket__v">{fmtDate(startsAt)}</div></div>
          <div><div className="tx-ticket__k">Doors</div><div className="tx-ticket__v">{fmtTime(startsAt)}</div></div>
          {venue && <div style={{ gridColumn: '1 / -1' }}><div className="tx-ticket__k">Venue</div><div className="tx-ticket__v">{venue}</div></div>}
        </div>
        <QR value={code} label={`Ticket QR code ${ticketNo}`} />
        <div className="tx-ticket__code">{ticketNo}</div>
      </div>
      <div className="tx-ticket__bar" />
    </div>
  );
}
