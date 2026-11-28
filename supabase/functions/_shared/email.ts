// Email through Resend (FR-2.2, FR-4.6, FR-5.3, FR-16). Without
// RESEND_API_KEY the email is printed to the function log instead, for
// local development.
import QRCode from 'npm:qrcode@1.5.4';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';
import { ticketSvg } from './ticket-svg.ts';
import { ticketTier } from './event-registration.ts';
import {
  applicationEmail, layout, noticeEmail, orderConfirmedEmail, orderPlacedEmail, orderRejectedEmail,
  statusLinkEmail, ticketEmail, waitlistEmail,
  type ApplicationNotice, type OrderDetails, type TicketDetails,
} from './templates.ts';

// Tickets come from EMAIL_FROM (tickets@…); everything else from no-reply@ on the same domain.
const ticketsFrom = Deno.env.get('EMAIL_FROM') ?? 'TEDxGUC <tickets@example.com>';
const noReplyFrom = ticketsFrom.replace(/<[^@>]+@/, '<no-reply@');
type SendOpts = { tickets?: boolean; replyTo?: string };
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

type Attachment = { filename: string; content: string; content_id?: string };

async function send(to: string, subject: string, html: string, text: string, attachments: Attachment[] = [], opts: SendOpts = {}) {
  const from = opts.tickets ? ticketsFrom : noReplyFrom;
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.log(`[email not sent: no RESEND_API_KEY] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text, attachments, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
  });
  if (!res.ok) {
    // The record is already saved; the person can ask for the link again.
    console.error('Email failed', res.status, await res.text());
  }
}

export const statusUrl = (token: string) => `${siteUrl}/tickets?t=${token}`;
export const applicationUrl = (token: string) => `${siteUrl}/join/status?t=${token}`;
export const orderUrl = (token: string) => `${siteUrl}/orders?t=${token}`;

async function qrAttachment(code: string, filename = 'ticket-qr.png'): Promise<Attachment> {
  const dataUrl: string = await QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 2, width: 480 });
  return { filename, content: dataUrl.split(',')[1], content_id: 'ticket-qr' };
}

// ---------------------------------------------------------------------
// The ticket as an image: the site's "Your place around the dot" design,
// drawn as SVG and rasterised with resvg. Fonts and logos come from the site.
// ---------------------------------------------------------------------
let artReady: Promise<{ fonts: Uint8Array[]; logos: Record<'white' | 'black', string> }> | null = null;
function artAssets() {
  artReady ??= (async () => {
    await initWasm(fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'));
    const get = async (p: string) => { const r = await fetch(`${siteUrl}${p}`); if (!r.ok) throw new Error(`asset ${p}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
    const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const [f5, f6, f8, lw, lb] = await Promise.all([get('/brand/fonts/archivo-500.ttf'), get('/brand/fonts/archivo-600.ttf'), get('/brand/fonts/archivo-800.ttf'), get('/brand/tedxguc-lockup-white.png'), get('/brand/tedxguc-lockup-black.png')]);
    return { fonts: [f5, f6, f8], logos: { white: `data:image/png;base64,${b64(lw)}`, black: `data:image/png;base64,${b64(lb)}` } };
  })().catch((e) => { artReady = null; throw e; });
  return artReady;
}
const cairo = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', ...o }).format(new Date(iso));

async function ticketImage(t: TicketDetails, code: string): Promise<Attachment> {
  const { fonts, logos } = await artAssets();
  const q = QRCode.create(code, { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  const qr = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!q.modules.get(r, c)));
  const vip = ticketTier(t.guest_type) === 'VIP';
  const { svg } = ticketSvg({
    eventTitle: t.event_title, eventKind: 'TEDxGUC', guestName: t.guest_name, vip,
    date: cairo(t.starts_at, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''),
    doors: cairo(t.starts_at, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
    venue: t.venue, ticketNo: t.ticket_no ?? '', qr, logoDataUrl: vip ? logos.white : logos.black,
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 760 }, font: { fontBuffers: fonts, defaultFontFamily: 'Archivo', loadSystemFonts: false } }).render().asPng();
  return { filename: `ticket-${t.ticket_no ?? 'tedxguc'}.png`, content: b64png(png), content_id: 'ticket-art' };
}
function b64png(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }

// The ticket image when it can be drawn, else the plain QR (the email always goes out).
async function ticketAttachments(t: TicketDetails, code: string): Promise<{ art: boolean; files: Attachment[] }> {
  try { return { art: true, files: [await ticketImage(t, code)] }; }
  catch (e) { console.error('Ticket image failed, sending the plain QR', e); return { art: false, files: [await qrAttachment(code)] }; }
}

// Event tickets
export async function sendTicket(t: TicketDetails & { ticket_code: string }, token?: string) {
  const { art, files } = await ticketAttachments(t, t.ticket_code);
  const mail = ticketEmail(t, token ? statusUrl(token) : undefined, art);
  await send(t.guest_email, mail.subject, mail.html, mail.text, files, { tickets: true });
}

export async function sendWaitlisted(t: TicketDetails & { waitlist_position: number }, token: string) {
  const mail = waitlistEmail(t, statusUrl(token));
  await send(t.guest_email, mail.subject, mail.html, mail.text, [], { tickets: true });
}

export async function sendStatusLink(t: TicketDetails & { ticket_code?: string | null; status: string }, token: string) {
  const withTicket = t.status === 'registered' && !!t.ticket_code;
  const { art, files } = withTicket ? await ticketAttachments(t, t.ticket_code!) : { art: false, files: [] };
  const mail = statusLinkEmail(t, statusUrl(token), art);
  await send(t.guest_email, mail.subject, mail.html, mail.text, files, { tickets: true });
}

// Recruitment
export async function sendApplicationNotice(a: ApplicationNotice, token?: string) {
  const mail = applicationEmail(a, token ? applicationUrl(token) : undefined);
  await send(a.applicant_email, mail.subject, mail.html, mail.text);
}

// Package orders
export async function sendOrderPlaced(o: OrderDetails, token: string) {
  const mail = orderPlacedEmail(o, orderUrl(token));
  await send(o.buyer_email, mail.subject, mail.html, mail.text);
}

export async function sendOrderConfirmed(o: OrderDetails & { pickup_code: string }) {
  const mail = orderConfirmedEmail(o);
  await send(o.buyer_email, mail.subject, mail.html, mail.text, [await qrAttachment(o.pickup_code, 'pickup-qr.png')]);
}

export async function sendOrderRejected(o: OrderDetails) {
  const mail = orderRejectedEmail(o);
  await send(o.buyer_email, mail.subject, mail.html, mail.text);
}

// Short notices (invites, orientation, contact messages) in the branded layout.
// Paragraphs are separated by blank lines; a paragraph ending in a link becomes
// the red button, so the wording at the call sites stays plain text.
export function plainToNotice(subject: string, text: string, kicker = 'TEDxGUC') {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let button: { label: string; url: string } | undefined;
  const linkAt = paragraphs.findIndex((p) => /https?:\/\/\S+\s*$/.test(p));
  if (linkAt >= 0) {
    const m = paragraphs[linkAt].match(/^([\s\S]*?)(https?:\/\/\S+)\s*$/)!;
    const lead = m[1].replace(/[:\s]+$/, '').trim();
    button = { label: /portal|log in|login|set up/i.test(lead + ' ' + m[2]) ? 'Open the portal' : 'Open link', url: m[2] };
    if (lead.length > 30) paragraphs[linkAt] = lead + '.'; else paragraphs.splice(linkAt, 1);
  }
  return noticeEmail({ kicker, title: subject, paragraphs: paragraphs.map((p) => p.replace(/\n/g, ' ')), button });
}

export async function sendPlain(to: string, subject: string, text: string, kicker = 'TEDxGUC', replyTo?: string) {
  const mail = plainToNotice(subject, text, kicker);
  await send(to, subject, mail.html, mail.text, [], { replyTo });
}

// A short notice with an explicit button (account emails: invites, password links).
export async function sendNotice(to: string, subject: string, n: { kicker: string; title: string; paragraphs: string[]; button?: { label: string; url: string }; after?: string[] }) {
  const mail = layout({ kicker: n.kicker, title: n.title, intro: n.paragraphs, button: n.button, after: n.after });
  await send(to, subject, mail.html, mail.text);
}
