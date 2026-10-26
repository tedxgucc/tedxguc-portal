// Email wording. Deliberately plain: the branded design is applied
// once the branding file arrives. No Deno APIs here, so it can be
// unit-tested with Node.
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

const DISCLAIMER = 'This independent TEDx event is operated under license from TED.';

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

function wrap(lines: string[], extraHtml = '') {
  const text = [...lines, '', DISCLAIMER].join('\n');
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">` +
    lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '')).join('') +
    extraHtml +
    `<p style="color:#666;font-size:12px">${escapeHtml(DISCLAIMER)}</p></div>`;
  return { text, html };
}

function eventLines(t: TicketDetails) {
  return [
    `Event: ${t.event_title}`,
    `When: ${formatCairo(t.starts_at)} (Cairo time)`,
    ...(t.venue ? [`Where: ${t.venue}`] : []),
  ];
}

export function ticketEmail(t: TicketDetails, statusUrl?: string) {
  const { text, html } = wrap(
    [
      `Hi ${t.guest_name},`,
      `You're in! Here is your ticket for ${t.event_title}.`,
      `Ticket number: ${t.ticket_no}`,
      `Ticket type: ${ticketTier(t.guest_type)}`,
      ...eventLines(t),
      'Show the QR code below at the door. Each ticket can be scanned once.',
      ...(statusUrl ? [`View or cancel your ticket: ${statusUrl}`] : []),
    ],
    `<p><img src="cid:ticket-qr" alt="Ticket QR code ${escapeHtml(t.ticket_no ?? '')}" width="240" height="240"></p>`,
  );
  return { subject: `Your ticket: ${t.event_title} (${t.ticket_no})`, text, html };
}

export function waitlistEmail(t: TicketDetails & { waitlist_position: number }, statusUrl: string) {
  const { text, html } = wrap([
    `Hi ${t.guest_name},`,
    `${t.event_title} is full right now, so you're on the waitlist (position ${t.waitlist_position}).`,
    "If a seat opens up, we'll email your ticket automatically.",
    ...eventLines(t),
    `Check your place or leave the waitlist: ${statusUrl}`,
  ]);
  return { subject: `You're on the waitlist: ${t.event_title}`, text, html };
}

export function statusLinkEmail(t: TicketDetails & { status: string }, statusUrl: string) {
  const registered = t.status === 'registered';
  const { text, html } = wrap(
    [
      `Hi ${t.guest_name},`,
      registered
        ? `Here is your ticket for ${t.event_title} again (${t.ticket_no}).`
        : `Here is the link to your waitlist place for ${t.event_title}.`,
      ...eventLines(t),
      `Your private link: ${statusUrl}`,
      `Ticket type: ${ticketTier(t.guest_type)}`,
      'Older links you received no longer work.',
    ],
    registered ? `<p><img src="cid:ticket-qr" alt="Ticket QR code" width="240" height="240"></p>` : '',
  );
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

const stageLines: Record<ApplicationNotice['stage'], (a: ApplicationNotice) => string[]> = {
  applied: (a) => [`We received your application for ${a.cycle_name}. We'll keep you posted here.`],
  screened: () => ['Good news: your application passed the first review. Next, the team will invite people to interviews.'],
  interview: () => ['You are invited to an interview! Open your link to pick a time that suits you.'],
  accepted: (a) => [
    `Congratulations, you're in! Welcome to ${a.team ?? 'the team'} at TEDxGUC.`,
    'You will get a separate email to set up your portal account.',
  ],
  rejected: (a) => [
    `Thank you for applying to TEDxGUC ${a.cycle_name}. We had many strong applicants and could not offer you a place this time.`,
    'We hope to see you at our events, and we would love to see you apply again next season.',
  ],
};

export function applicationEmail(a: ApplicationNotice, statusUrl?: string) {
  const { text, html } = wrap([
    `Hi ${a.applicant_name},`,
    ...stageLines[a.stage](a),
    ...(statusUrl && a.stage !== 'rejected' ? [`Your application: ${statusUrl}`] : []),
  ]);
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
  const lines = [`Hi ${o.buyer_name},`, `Your order ${o.order_no} (${o.package_name}) is reserved. Total: ${egp(o.total_egp)}.`];
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
  lines.push(`Your order: ${statusUrl}`);
  const { text, html } = wrap(lines);
  return { subject: `Order ${o.order_no}: how to pay`, text, html };
}

export function orderConfirmedEmail(o: OrderDetails, statusUrl?: string) {
  const { text, html } = wrap(
    [
      `Hi ${o.buyer_name},`,
      `Payment received. Order ${o.order_no} is confirmed.`,
      `${o.quantity ?? 1} × ${o.package_name} · ${egp(o.total_egp)}`,
      ...(o.pickup_info ? [`Pick up at: ${o.pickup_info}`] : []),
      'Show the QR code below when you collect your package.',
      ...(statusUrl ? [`Your order: ${statusUrl}`] : []),
    ],
    `<p><img src="cid:ticket-qr" alt="Pickup QR code for ${escapeHtml(o.order_no)}" width="240" height="240"></p>`,
  );
  return { subject: `Confirmed: order ${o.order_no}`, text, html };
}

export function orderRejectedEmail(o: OrderDetails) {
  const { text, html } = wrap([
    `Hi ${o.buyer_name},`,
    `We could not confirm the payment for order ${o.order_no}.`,
    ...(o.reject_reason ? [`Reason: ${o.reject_reason}`] : []),
    'If you did pay, reply to this email with your transfer screenshot and we will sort it out.',
  ]);
  return { subject: `Order ${o.order_no}: payment not confirmed`, text, html };
}
