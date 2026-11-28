// The QR ticket as one SVG ("Your place around the dot"), the same design as
// web/src/components/Ticket.tsx: the red dot is the stage, the audience sits in
// rings around it, and a red x marks one seat picked by the ticket number.
// Email apps can't show the site's animated ticket, so the server rasterises
// this SVG to a PNG and attaches it. Pure TS (no Deno APIs) so Node can test it.

const XPTS: [number, number][] = [[2, 0], [59, 83], [0, 170], [63, 170], [88, 128], [113, 170], [176, 170], [117, 83], [174, 0], [111, 0], [88, 39], [65, 0]];
const CX = 170, CY = 176, R = 96, RINGS = [120, 136, 152, 168, 184, 200, 216];
const RED = '#e62b1e';

export type TicketArt = {
  eventTitle: string;
  eventKind: string;
  guestName: string;
  vip: boolean;
  date: string;      // e.g. "Thu 17 Dec"
  doors: string;     // e.g. "6:30 pm"
  venue: string | null;
  ticketNo: string;
  qr: boolean[][];   // QR modules (true = dark)
  logoDataUrl?: string; // TEDxGUC lockup PNG as a data URL (white for VIP, black otherwise)
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function stagePlan(ticketNo: string) {
  type Seat = { x: number; y: number; ri: number };
  const seats: Seat[] = [];
  RINGS.forEach((r, ri) => {
    const n = Math.floor((2 * Math.PI * r) / 13.5);
    for (let i = 0; i < n; i++) { const a = ((i + (ri % 2) * 0.5) / n) * 2 * Math.PI; seats.push({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), ri }); }
  });
  const hidden = (s: Seat) => s.y < 52 && (s.x < 150 || s.x > 232);
  const ok = seats.filter((s) => !hidden(s) && s.x > 46 && s.x < 294 && s.y > 66 && s.y < 306 && s.ri < 3);
  const num = parseInt(ticketNo.replace(/\D/g, ''), 10) || 1;
  const you = ok[(num * 7919) % ok.length];
  const rest = seats.filter((s) => s !== you && !hidden(s));
  const k = 15 / 170;
  const xPoints = XPTS.map(([px, py]) => `${((px - 88) * k + you.x).toFixed(2)},${((py - 85) * k + you.y).toFixed(2)}`).join(' ');
  return { you, rest, xPoints };
}

// Rough text width for Archivo (em units per character), to wrap and fit lines.
const width = (s: string, size: number, weight: number) => s.length * size * (weight >= 800 ? 0.6 : 0.54);
function wrap(text: string, size: number, maxW: number, weight: number, maxLines = 2): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (width(t, size, weight) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

export function ticketSvg(t: TicketArt): { svg: string; width: number; height: number } {
  const C = t.vip
    ? { paper: '#0c0c0c', ink: '#ffffff', ink2: '#a9a5a0', seat: '#3b3a39', rule: '#2e2d2c', foot: RED }
    : { paper: '#ffffff', ink: '#0c0c0c', ink2: '#5f5c58', seat: '#d3cfc9', rule: '#dedbd6', foot: '#0c0c0c' };
  const W = 380, S = W / 340; // the stage plan is drawn in 340 units
  const plan = stagePlan(t.ticketNo);
  const tier = t.vip ? 'VIP' : 'Guest';
  const F = "Archivo, sans-serif";

  // Stage (scaled from 340 to 380 wide)
  const seats = plan.rest.map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="2.3" fill="${C.seat}"/>`).join('');
  const ringR = R - 11;
  const ringText = `IDEAS WORTH SPREADING • ${t.eventTitle.toUpperCase()} • ${t.date.toUpperCase()} • `;
  const ringPath = `M${CX} ${CY} m-${ringR} 0 a${ringR} ${ringR} 0 1 1 ${2 * ringR} 0 a${ringR} ${ringR} 0 1 1 -${2 * ringR} 0`;
  const titleSize = t.eventTitle.length > 11 ? 21 : t.eventTitle.length > 8 ? 25 : 31;
  const titleLines = wrap(t.eventTitle, titleSize, 150, 800);
  const blockH = 10 + 7 + titleLines.length * titleSize * 0.92 + 6 + 12;
  let y = CY + 4 - blockH / 2;
  const onDot =
    `<text x="${CX}" y="${(y += 9).toFixed(1)}" text-anchor="middle" font-family="${F}" font-weight="600" font-size="9.5" letter-spacing="1.7" fill="#fff" fill-opacity=".9">${esc(t.eventKind.toUpperCase())}</text>` +
    titleLines.map((l) => `<text x="${CX}" y="${(y += (l === titleLines[0] ? 7 : 0) + titleSize * 0.92).toFixed(1)}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="${titleSize}" letter-spacing="-0.8" fill="#fff">${esc(l)}</text>`).join('') +
    `<text x="${CX}" y="${(y += 6 + 11.5).toFixed(1)}" text-anchor="middle" font-family="${F}" font-weight="600" font-size="11.5" fill="#fff">${esc(`${t.date} · doors ${t.doors}`)}</text>`;
  const youLab = `<rect x="${(plan.you.x - 13).toFixed(1)}" y="${(plan.you.y + 12).toFixed(1)}" width="26" height="13" rx="3" fill="${C.paper}"/>` +
    `<text x="${plan.you.x.toFixed(1)}" y="${(plan.you.y + 21.5).toFixed(1)}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="8" letter-spacing="1.1" fill="${C.ink}">YOU</text>`;
  const stage =
    `<g transform="scale(${S})" clip-path="url(#stage)">` + seats +
    `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${RED}"/>` +
    `<defs><path id="ring" d="${ringPath}"/></defs>` +
    `<text font-family="${F}" font-weight="600" font-size="8.6" letter-spacing="2" fill="#fff"><textPath href="#ring" textLength="${(2 * Math.PI * ringR - 6).toFixed(0)}">${esc(ringText)}</textPath></text>` +
    `<circle cx="${plan.you.x.toFixed(1)}" cy="${plan.you.y.toFixed(1)}" r="9" fill="none" stroke="${RED}" stroke-width="1.4"/>` +
    `<circle cx="${plan.you.x.toFixed(1)}" cy="${plan.you.y.toFixed(1)}" r="10.5" fill="${C.paper}"/>` +
    `<polygon points="${plan.xPoints}" fill="${RED}"/>` +
    onDot + youLab + `</g>`;
  // Logo (top left) and tier pill (top right), with a paper halo like the site.
  const logo = t.logoDataUrl
    ? `<rect x="11" y="11" width="132" height="33" rx="3" fill="${C.paper}"/><image href="${t.logoDataUrl}" x="18" y="18" height="19" width="118" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="18" y="34" font-family="${F}" font-weight="800" font-size="20" fill="${RED}">TEDx<tspan fill="${C.ink}" font-weight="600">GUC</tspan></text>`;
  const pillW = tier === 'VIP' ? 62 : 84;
  const pill = `<rect x="${W - 16 - pillW - 6}" y="8" width="${pillW + 12}" height="40" rx="20" fill="${C.paper}"/>` +
    `<rect x="${W - 16 - pillW}" y="14" width="${pillW}" height="28" rx="14" fill="${C.ink}"/>` +
    `<circle cx="${W - 16 - pillW + 15}" cy="28" r="3.5" fill="${RED}"/>` +
    `<text x="${W - 16 - pillW + 25}" y="32.5" font-family="${F}" font-weight="800" font-size="12" letter-spacing="1.4" fill="${C.paper}">${tier.toUpperCase()}</text>`;

  // Paper part
  let py = W + 2;
  const perf = `<line x1="22" y1="${py}" x2="${W - 22}" y2="${py}" stroke="${C.rule}" stroke-width="2" stroke-dasharray="6 5"/>`;
  const k = (x: number, yy: number, s: string) => `<text x="${x}" y="${yy}" font-family="${F}" font-weight="600" font-size="9.5" letter-spacing="1.5" fill="${C.ink2}">${esc(s.toUpperCase())}</text>`;
  const v = (x: number, yy: number, s: string, size = 14.5, weight = 600) => `<text x="${x}" y="${yy}" font-family="${F}" font-weight="${weight}" font-size="${size}" fill="${C.ink}">${esc(s)}</text>`;
  py += 20;
  let body = k(20, py + 9, 'Admit one');
  const nameLines = wrap(t.guestName, 27, W - 40, 800);
  nameLines.forEach((l) => { py += 27; body += v(20, py + 14, l, 27, 800); });
  py += 30;
  const col = (W - 40 - 20) / 3;
  body += k(20, py + 9, 'Date') + v(20, py + 28, t.date) + k(20 + col + 10, py + 9, 'Doors') + v(20 + col + 10, py + 28, t.doors) + k(20 + 2 * (col + 10), py + 9, 'Seat') + v(20 + 2 * (col + 10), py + 28, 'Free seating', 13);
  py += 44;
  if (t.venue) {
    const venueLines = wrap(t.venue, 14.5, W - 40, 600, 2);
    body += k(20, py + 9, 'Venue');
    venueLines.forEach((l, i) => { body += v(20, py + 28 + i * 18, l); });
    py += 30 + venueLines.length * 18;
  }
  py += 4;
  body += `<line x1="20" y1="${py}" x2="${W - 20}" y2="${py}" stroke="${C.rule}" stroke-width="1"/>`;
  py += 16;
  // QR on white, always dark-on-light so scanners read it.
  const n = t.qr.length, qs = 132, pad = 8, cell = (qs - pad * 2) / n;
  let qrRects = '';
  t.qr.forEach((row, r) => row.forEach((on, c) => { if (on) qrRects += `<rect x="${(20 + pad + c * cell).toFixed(2)}" y="${(py + pad + r * cell).toFixed(2)}" width="${(cell + 0.02).toFixed(2)}" height="${(cell + 0.02).toFixed(2)}"/>`; }));
  body += `<rect x="20" y="${py}" width="${qs}" height="${qs}" rx="14" fill="#fff" stroke="${C.rule}"/><g fill="#000">${qrRects}</g>`;
  const tx = 20 + qs + 14;
  body += k(tx, py + 30, 'Ticket') + `<text x="${tx}" y="${py + 50}" font-family="${F}" font-weight="500" font-size="15" letter-spacing="0.9" fill="${C.ink}">${esc(t.ticketNo)}</text>`;
  const lx = `<polygon transform="translate(${tx},${py + 84}) scale(${11 / 176})" points="${XPTS.map(([a, b]) => `${a},${b}`).join(' ')}" fill="${RED}"/>`;
  body += `<circle cx="${tx + 5.5}" cy="${py + 74}" r="5" fill="${RED}"/>` + `<text x="${tx + 18}" y="${py + 78}" font-family="${F}" font-weight="500" font-size="11" fill="${C.ink2}">The red dot: the stage</text>` +
    lx + `<text x="${tx + 18}" y="${py + 94}" font-family="${F}" font-weight="500" font-size="11" fill="${C.ink2}">The x: your place</text>`;
  py += qs + 18;
  // Footer band
  const foot = `<rect x="0" y="${py}" width="${W}" height="34" fill="${C.foot}"/>` +
    `<text x="20" y="${py + 21}" font-family="${F}" font-weight="600" font-size="9.5" letter-spacing="1.7" fill="#fff">IDEAS WORTH SPREADING</text>` +
    `<text x="${W - 20}" y="${py + 21}" text-anchor="end" font-family="${F}" font-weight="600" font-size="9.5" letter-spacing="1.7" fill="#fff">${tier.toUpperCase()}</text>`;
  const H = py + 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="22"/></clipPath><clipPath id="stage"><rect width="340" height="340"/></clipPath></defs>` +
    `<g clip-path="url(#card)"><rect width="${W}" height="${H}" fill="${C.paper}"/>${stage}${logo}${pill}${perf}${body}${foot}</g></svg>`;
  return { svg, width: W, height: H };
}
