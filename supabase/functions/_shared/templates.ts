// Email wording and the branded layout (red dot style: black header with the
// TEDxGUC logo, red accents, a details card, a red button, the QR framed like
// the ticket). Email-safe HTML: tables and inline styles only, no web fonts,
// works in Gmail, Outlook and Apple Mail, light and dark.
// No Deno APIs here, so it can be unit-tested with Node.
import { ticketTier } from './event-registration.ts';

export type TicketDetails = {
  guest_name: string;
  guest_email: string;
  guest_type?: string;
  event_title: string;
  starts_at: string;
  venue: string | null;
  ticket_no?: string | null;
};

const DISCLAIMER = 'This independent TEDxGUC event is operated under license from TED.';
const SITE = 'https://tedxguc.org';
const LOGO = `${SITE}/brand/tedxguc-lockup-white.png`;
const RED = '#e62b1e';
const INK = '#0c0c0c';
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export function formatCairo(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(iso));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Escapes text and turns bare links into clickable ones.
function rich(s: string): string {
  return escapeHtml(s).replace(/https?:\/\/[^\s<]+/g, (raw) => {
    const u = raw.replace(/[.,;:!?)]+$/, ''), tail = raw.slice(u.length);
    return `<a href="${u}" style="color:${RED};text-decoration:underline;word-break:break-all">${u}</a>${tail}`;
  });
}

export type Layout = {
  /** Small red caps line above the title, e.g. "Your ticket". */
  kicker: string;
  title: string;
  /** Hidden inbox preview text. */
  preheader?: string;
  greeting?: string;
  intro?: string[];
  details?: [string, string][];
  button?: { label: string; url: string };
  /** cid of an attached QR image, shown framed like the ticket. */
  qr?: { cid: string; alt: string; caption: string };
  /** Keep the details in the plain-text version only (the ticket image already shows them). */
  detailsTextOnly?: boolean;
  /** A full ticket image (cid), shown large instead of the QR box. */
  ticket?: { cid: string; alt: string; caption: string };
  after?: string[];
};

export function layout(m: Layout): { html: string; text: string } {
  const p = (s: string) => `<p style="margin:0 0 14px;font:16px/1.55 ${FONT};color:#3a3835">${rich(s)}</p>`;
  const details = m.details?.length && !m.detailsTextOnly
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;border-collapse:separate;background:#f6f5f2;border-radius:14px">` +
      m.details.map(([k, v], i) =>
        `<tr><td style="padding:${i ? 10 : 16}px 18px ${i === m.details!.length - 1 ? 16 : 10}px;${i ? 'border-top:1px solid #e4e1dc;' : ''}font:700 11px/1.3 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:#8a8580;width:34%;vertical-align:top">${escapeHtml(k)}</td>` +
        `<td style="padding:${i ? 10 : 16}px 18px ${i === m.details!.length - 1 ? 16 : 10}px;${i ? 'border-top:1px solid #e4e1dc;' : ''}font:600 15px/1.4 ${FONT};color:${INK}">${rich(v)}</td></tr>`).join('') +
      `</table>`
    : '';
  const qr = m.qr
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td align="center" style="padding:22px;border:2px dashed #dedbd6;border-radius:18px">` +
      `<img src="cid:${m.qr.cid}" alt="${escapeHtml(m.qr.alt)}" width="220" height="220" style="display:block;width:220px;height:220px;border:0;background:#fff">` +
      `<p style="margin:12px 0 0;font:600 13px/1.4 ${FONT};color:#5f5c58">${escapeHtml(m.qr.caption)}</p></td></tr></table>`
    : '';
  const ticket = m.ticket
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td align="center">` +
      `<img src="cid:${m.ticket.cid}" alt="${escapeHtml(m.ticket.alt)}" width="380" style="display:block;width:100%;max-width:380px;height:auto;border:0;border-radius:22px">` +
      `<p style="margin:12px 0 0;font:600 13px/1.4 ${FONT};color:#5f5c58">${escapeHtml(m.ticket.caption)}</p></td></tr></table>`
    : '';
  const button = m.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 24px"><tr><td style="border-radius:999px;background:${RED}">` +
      `<a href="${escapeHtml(m.button.url)}" style="display:inline-block;padding:14px 28px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(m.button.label)} &rarr;</a></td></tr></table>`
    : '';
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(m.title)}</title></head>` +
    `<body style="margin:0;padding:0;background:#eeece8">` +
    (m.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(m.preheader)}</div>` : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8"><tr><td align="center" style="padding:28px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden">` +
    // Header: black band, logo, the red dot peeking in.
    `<tr><td style="background:${INK};padding:26px 28px 24px;position:relative">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td><a href="${SITE}"><img src="${LOGO}" alt="TEDxGUC" height="26" style="display:block;height:26px;border:0"></a></td>` +
    `<td align="right"><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${RED}"></span></td>` +
    `</tr></table></td></tr>` +
    `<tr><td style="height:6px;background:${RED};font-size:0;line-height:0">&nbsp;</td></tr>` +
    // Body
    `<tr><td style="padding:30px 28px 8px">` +
    `<p style="margin:0 0 8px;font:700 12px/1.3 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${RED}">${escapeHtml(m.kicker)}</p>` +
    `<h1 style="margin:0 0 20px;font:800 28px/1.1 ${FONT};letter-spacing:-.01em;color:${INK}">${escapeHtml(m.title)}</h1>` +
    (m.greeting ? p(m.greeting) : '') +
    (m.intro ?? []).map(p).join('') +
    details + ticket + qr + button +
    (m.after ?? []).map(p).join('') +
    `</td></tr>` +
    // Footer
    `<tr><td style="padding:18px 28px 26px;border-top:1px solid #eeece8">` +
    `<p style="margin:0 0 6px;font:700 12px/1.4 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${INK}">Ideas worth spreading</p>` +
    `<p style="margin:0;font:12px/1.5 ${FONT};color:#8a8580">${escapeHtml(DISCLAIMER)}<br><a href="${SITE}" style="color:#8a8580">tedxguc.org</a></p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text = [
    m.title.toUpperCase(),
    '',
    ...(m.greeting ? [m.greeting, ''] : []),
    ...(m.intro ?? []),
    ...(m.details?.length ? ['', ...m.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(m.qr ? ['', m.qr.caption] : []),
    ...(m.ticket ? ['', m.ticket.caption] : []),
    ...(m.button ? ['', `${m.button.label}: ${m.button.url}`] : []),
    ...(m.after?.length ? ['', ...m.after] : []),
    '',
    '—',
    DISCLAIMER,
    SITE,
  ].join('\n');
  return { html, text };
}

function eventDetails(t: TicketDetails): [string, string][] {
  return [
    ['Event', t.event_title],
    ['When', `${formatCairo(t.starts_at)} (Cairo time)`],
    ...(t.venue ? [['Where', t.venue] as [string, string]] : []),
  ];
}

export function ticketEmail(t: TicketDetails, statusUrl?: string, art = false) {
  const { text, html } = layout({
    kicker: 'Your ticket',
    title: `You're in, ${t.guest_name.split(' ')[0]}.`,
    preheader: `Your ticket for ${t.event_title}: show the QR code at the door.`,
    intro: [`Here is your ticket for ${t.event_title}. See you around the red dot.`],
    detailsTextOnly: art,
    details: [
      ...eventDetails(t),
      ['Ticket number', t.ticket_no ?? ''],
      ['Ticket type', ticketTier(t.guest_type)],
    ],
    ...(art
      ? { ticket: { cid: 'ticket-art', alt: `TEDxGUC ticket ${t.ticket_no ?? ''} for ${t.guest_name}, with QR code`, caption: 'Show this ticket at the door. Each ticket can be scanned once. Tip: screenshot it.' } }
      : { qr: { cid: 'ticket-qr', alt: `Ticket QR code ${t.ticket_no ?? ''}`, caption: 'Show this QR code at the door. Each ticket can be scanned once.' } }),
    button: statusUrl ? { label: 'View or cancel your ticket', url: statusUrl } : undefined,
  });
  return { subject: `Your ticket: ${t.event_title} (${t.ticket_no})`, text, html };
}

export function waitlistEmail(t: TicketDetails & { waitlist_position: number }, statusUrl: string) {
  const { text, html } = layout({
    kicker: 'Waitlist',
    title: `You're on the waitlist (position ${t.waitlist_position}).`,
    preheader: `${t.event_title} is full right now. We'll email your ticket if a seat opens.`,
    greeting: `Hi ${t.guest_name},`,
    intro: [`${t.event_title} is full right now, so you're on the waitlist (position ${t.waitlist_position}).`, "If a seat opens up, we'll email your ticket automatically."],
    details: eventDetails(t),
    button: { label: 'Check your place', url: statusUrl },
    after: ['You can leave the waitlist from the same link.'],
  });
  return { subject: `You're on the waitlist: ${t.event_title}`, text, html };
}

export function statusLinkEmail(t: TicketDetails & { status: string }, statusUrl: string, art = false) {
  const registered = t.status === 'registered';
  const { text, html } = layout({
    kicker: registered ? 'Your ticket, again' : 'Your waitlist place',
    title: registered ? `Here's your ticket for ${t.event_title}.` : `Your place for ${t.event_title}.`,
    greeting: `Hi ${t.guest_name},`,
    intro: [registered ? `Here is your ticket for ${t.event_title} again (${t.ticket_no}).` : `Here is the link to your waitlist place for ${t.event_title}.`],
    details: [...eventDetails(t), ['Ticket type', ticketTier(t.guest_type)]],
    ...(registered && art ? { ticket: { cid: 'ticket-art', alt: `TEDxGUC ticket ${t.ticket_no ?? ''}, with QR code`, caption: 'Show this ticket at the door.' } } : {}),
    qr: registered && !art ? { cid: 'ticket-qr', alt: 'Ticket QR code', caption: 'Show this QR code at the door.' } : undefined,
    button: { label: registered ? 'Open your ticket' : 'Open your place', url: statusUrl },
    after: ['Older links you received no longer work.'],
  });
  return { subject: `Your TEDxGUC link: ${t.event_title}`, text, html };
}

// ---------------------------------------------------------------------
// Recruitment (FR-4.6)
// ---------------------------------------------------------------------
export type ApplicationNotice = {
  applicant_name: string;
  applicant_email: string;
  cycle_name: string;
  stage: 'applied' | 'screened' | 'interview' | 'accepted' | 'rejected';
  team?: string;
};

const stageCopy: Record<ApplicationNotice['stage'], (a: ApplicationNotice) => { kicker: string; title: string; lines: string[]; button?: string }> = {
  applied: (a) => ({ kicker: 'Application received', title: 'We got your application.', lines: [`We received your application for ${a.cycle_name}. We'll keep you posted here.`], button: 'Track your application' }),
  screened: () => ({ kicker: 'Next step', title: 'You passed the first review.', lines: ['Good news: your application passed the first review. Next, the team will invite people to interviews.'], button: 'Track your application' }),
  interview: () => ({ kicker: 'Interview', title: "You're invited to an interview.", lines: ['You are invited to an interview! Open your link to pick a time that suits you.'], button: 'Pick your interview time' }),
  accepted: (a) => ({
    kicker: 'Welcome to TEDxGUC',
    title: "Congratulations, you're in!",
    lines: [`Congratulations, you're in! Welcome to ${a.team ?? 'the team'} at TEDxGUC.`, 'You will get a separate email to set up your portal account.'],
    button: 'See your application',
  }),
  rejected: (a) => ({
    kicker: 'Your application',
    title: 'Thank you for applying.',
    lines: [
      `Thank you for applying to TEDxGUC ${a.cycle_name}. We had many strong applicants and could not offer you a place this time.`,
      'We hope to see you at our events, and we would love to see you apply again next season.',
    ],
  }),
};

export function applicationEmail(a: ApplicationNotice, statusUrl?: string) {
  const c = stageCopy[a.stage](a);
  const { text, html } = layout({
    kicker: c.kicker,
    title: c.title,
    greeting: `Hi ${a.applicant_name},`,
    intro: c.lines,
    button: statusUrl && c.button ? { label: c.button, url: statusUrl } : undefined,
  });
  const subjects: Record<ApplicationNotice['stage'], string> = {
    applied: 'We got your application',
    screened: 'Your application: next step',
    interview: 'Interview invitation',
    accepted: 'Welcome to TEDxGUC',
    rejected: 'Your TEDxGUC application',
  };
  return { subject: `TEDxGUC: ${subjects[a.stage]}`, text, html };
}

// ---------------------------------------------------------------------
// Package orders (FR-16)
// ---------------------------------------------------------------------
export type OrderDetails = {
  buyer_name: string;
  buyer_email: string;
  order_no: string;
  package_name: string;
  total_egp: number | string;
  method?: 'instapay' | 'telda' | 'cash';
  quantity?: number;
  payment_link?: string | null;
  hold_expires_at?: string | null;
  pickup_info?: string | null;
  reject_reason?: string | null;
};

export const egp = (n: number | string) =>
  `EGP ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function orderPlacedEmail(o: OrderDetails, statusUrl: string) {
  const lines = [`Your order ${o.order_no} (${o.package_name}) is reserved. Total: ${egp(o.total_egp)}.`];
  if (o.method === 'cash') {
    lines.push(`Pay in cash at the TEDxGUC booth${o.pickup_info ? ` (${o.pickup_info})` : ''}` +
      (o.hold_expires_at ? ` before ${formatCairo(o.hold_expires_at)}` : '') + '.');
  } else {
    lines.push(
      `Pay ${egp(o.total_egp)} by ${o.method === 'telda' ? 'Telda' : 'InstaPay'}${o.payment_link ? `: ${o.payment_link}` : ''}.`,
      `Write ${o.order_no} in the transfer note, then upload the screenshot from your order page.`,
    );
    if (o.hold_expires_at) lines.push(`We hold your order until ${formatCairo(o.hold_expires_at)}.`);
  }
  const { text, html } = layout({
    kicker: 'How to pay',
    title: 'Your order is reserved.',
    greeting: `Hi ${o.buyer_name},`,
    intro: lines,
    details: [['Order', o.order_no], ['Item', `${o.quantity ?? 1} × ${o.package_name}`], ['Total', egp(o.total_egp)]],
    button: { label: 'Open your order', url: statusUrl },
  });
  return { subject: `Order ${o.order_no}: how to pay`, text, html };
}

export function orderConfirmedEmail(o: OrderDetails, statusUrl?: string) {
  const { text, html } = layout({
    kicker: 'Payment received',
    title: 'Your order is confirmed.',
    greeting: `Hi ${o.buyer_name},`,
    intro: [`Payment received. Order ${o.order_no} is confirmed.`],
    details: [
      ['Order', o.order_no],
      ['Item', `${o.quantity ?? 1} × ${o.package_name} · ${egp(o.total_egp)}`],
      ...(o.pickup_info ? [['Pick up at', o.pickup_info] as [string, string]] : []),
    ],
    qr: { cid: 'ticket-qr', alt: `Pickup QR code for ${o.order_no}`, caption: 'Show the QR code below when you collect your package.' },
    button: statusUrl ? { label: 'Open your order', url: statusUrl } : undefined,
  });
  return { subject: `Confirmed: order ${o.order_no}`, text, html };
}

export function orderRejectedEmail(o: OrderDetails) {
  const { text, html } = layout({
    kicker: 'Payment not confirmed',
    title: `We couldn't confirm order ${o.order_no}.`,
    greeting: `Hi ${o.buyer_name},`,
    intro: [`We could not confirm the payment for order ${o.order_no}.`, ...(o.reject_reason ? [`Reason: ${o.reject_reason}`] : [])],
    after: ['If you did pay, reply to this email with your transfer screenshot and we will sort it out.'],
  });
  return { subject: `Order ${o.order_no}: payment not confirmed`, text, html };
}

// ---------------------------------------------------------------------
// Short notices (invites, orientation, contact messages): same layout.
// ---------------------------------------------------------------------
export function noticeEmail(n: { kicker: string; title: string; paragraphs: string[]; button?: { label: string; url: string }; details?: [string, string][] }) {
  const [greeting, ...rest] = n.paragraphs[0]?.startsWith('Hi ') ? n.paragraphs : ['', ...n.paragraphs];
  return layout({ kicker: n.kicker, title: n.title, greeting: greeting || undefined, intro: rest, details: n.details, button: n.button });
}
