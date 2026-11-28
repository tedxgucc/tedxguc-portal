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
const LOGO = `${SITE}/brand/tedxguc-lockup-black.png`;
const INSTAGRAM = 'https://www.instagram.com/tedxguc__/';
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
  // Dark red-dot design: black canvas, logo + red dot, the stage dot with the TEDx x
  // as hero, red kicker, big white title, grey copy, dark cards, red pill button.
  const F = FONT, GREY = '#3a3835', MUTED = '#8a8580', CARD = '#f6f5f2', LINE = '#e4e1dc', BG = '#ffffff';
  const p = (s: string) => `<p style="margin:16px 0 0;font:400 16px/1.6 ${F};color:${GREY}">${rich(s)}</p>`;
  const row = (inner: string) => `<tr><td style="padding-top:24px">${inner}</td></tr>`;
  const details = m.details?.length && !m.detailsTextOnly
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="background:${CARD};border-radius:14px;border:1px solid ${LINE}"><tr><td style="padding:6px 20px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
      m.details.map(([k, v], i) => {
        const top = i ? `border-top:1px solid ${LINE};` : '';
        return `<tr><td width="42%" style="padding:12px 0;${top}vertical-align:top"><span style="font:700 11px/1.4 ${F};letter-spacing:.1em;text-transform:uppercase;color:${MUTED}">${escapeHtml(k)}</span></td>` +
          `<td width="58%" style="padding:12px 0;${top}text-align:right"><span style="font:600 15px/1.4 ${F};color:${INK}">${rich(v)}</span></td></tr>`;
      }).join('') + `</table></td></tr></table>`
    : '';
  const ticket = m.ticket
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><img src="cid:${m.ticket.cid}" width="380" alt="${escapeHtml(m.ticket.alt)}" style="width:100%;max-width:380px;height:auto;border-radius:22px;display:block;border:0"><p style="margin:12px 0 0;font:400 13px/1.5 ${F};color:${MUTED}">${escapeHtml(m.ticket.caption)}</p></td></tr></table>`
    : '';
  const qr = m.qr
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px"><tr><td style="padding:14px"><img src="cid:${m.qr.cid}" width="220" height="220" alt="${escapeHtml(m.qr.alt)}" style="display:block;width:220px;max-width:100%;height:auto"></td></tr></table><p style="margin:12px 0 0;font:400 13px/1.5 ${F};color:${MUTED}">${escapeHtml(m.qr.caption)}</p></td></tr></table>`
    : '';
  const button = m.button
    ? `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(m.button.url)}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="50%" strokecolor="${RED}" fillcolor="${RED}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(m.button.label)}</center></v:roundrect><![endif]-->` +
      `<!--[if !mso]><!-- --><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="${RED}" style="border-radius:999px"><a href="${escapeHtml(m.button.url)}" style="display:inline-block;padding:15px 28px;font:700 16px/1.25 ${F};color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(m.button.label)}&nbsp;&rarr;</a></td></tr></table><!--<![endif]-->`
    : '';
  const after = (m.after ?? []).map((s) => `<p style="margin:0 0 8px;font:400 13px/1.6 ${F};color:${MUTED}">${rich(s)}</p>`).join('');
  const blocks = [details, ticket, qr, button, after].filter(Boolean).map(row).join('');
  const html =
    `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(m.title)}</title>` +
    `<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->` +
    `<style>@media only screen and (min-width:620px){.px{padding-left:40px!important;padding-right:40px!important}.title{font-size:40px!important}}</style></head>` +
    `<body class="bg" style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%">` +
    (m.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BG};opacity:0">${escapeHtml(m.preheader)}${'&nbsp;&zwnj;'.repeat(60)}</div>` : '') +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${BG}" class="bg" style="background:${BG}"><tr><td align="center" style="padding:20px 0 32px">` +
    `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="container" style="width:100%;max-width:600px;margin:0 auto">` +
    // Header: small logo over a thin line
    `<tr><td class="px" style="padding:4px 24px 18px;border-bottom:1px solid ${LINE}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
    `<td align="left" valign="middle"><a href="${SITE}"><img src="${LOGO}" width="112" height="23" alt="TEDxGUC" style="display:block;border:0;height:23px;width:112px"></a></td>` +
    `</tr></table></td></tr>` +
    // Body: kicker, title and copy
    `<tr><td class="px" style="padding:0 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
    `<tr><td style="padding-top:22px"><p style="margin:0;font:700 12px/1.3 ${F};letter-spacing:.14em;text-transform:uppercase;color:${RED}">${escapeHtml(m.kicker)}</p>` +
    `<h1 class="title txt" style="margin:10px 0 0;font:800 34px/1.05 ${F};letter-spacing:-.02em;color:${INK}">${escapeHtml(m.title)}</h1>` +
    (m.greeting ? p(m.greeting) : '') + (m.intro ?? []).map(p).join('') +
    `</td></tr>` + blocks + `</table></td></tr>` +
    // Footer
    `<tr><td class="px" style="padding:36px 24px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${LINE}"><tr><td style="padding-top:24px">` +
    `<p style="margin:0;font:800 15px/1.2 ${F};letter-spacing:-.01em;color:${INK}">Ideas worth spreading</p>` +
    `<p style="margin:12px 0 0;font:400 12px/1.6 ${F};color:${MUTED}">${escapeHtml(DISCLAIMER)}</p>` +
    `<p style="margin:12px 0 0;font:400 12px/1.6 ${F};color:${MUTED}"><a href="${SITE}" style="color:${MUTED};text-decoration:underline">tedxguc.org</a>&nbsp;&middot;&nbsp;<a href="${INSTAGRAM}" style="color:${MUTED};text-decoration:underline">@tedxguc__</a></p>` +
    `</td></tr></table></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;

  const text = [
    m.title,
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
    'Ideas worth spreading',
    DISCLAIMER,
    `${SITE} · instagram.com/tedxguc__`,
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
    intro: art ? [] : [`Here is your ticket for ${t.event_title}. See you around the red dot.`],
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
