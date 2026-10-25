// Email through Resend (FR-2.2, FR-4.6, FR-5.3, FR-16). Without
// RESEND_API_KEY the email is printed to the function log instead, for
// local development.
import QRCode from 'npm:qrcode@1.5.4';
import {
  applicationEmail, escapeHtml, orderConfirmedEmail, orderPlacedEmail, orderRejectedEmail,
  statusLinkEmail, ticketEmail, waitlistEmail,
  type ApplicationNotice, type OrderDetails, type TicketDetails,
} from './templates.ts';

const from = Deno.env.get('EMAIL_FROM') ?? 'TEDxGUC <tickets@example.com>';
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

type Attachment = { filename: string; content: string; content_id?: string };

async function send(to: string, subject: string, html: string, text: string, attachments: Attachment[] = []) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.log(`[email not sent: no RESEND_API_KEY] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text, attachments }),
  });
  if (!res.ok) {
    // The record is already saved; the person can ask for the link again.
    console.error('Email failed', res.status, await res.text());
  }
}

export const statusUrl = (token: string) => `${siteUrl}/tickets/${token}`;
export const applicationUrl = (token: string) => `${siteUrl}/join/status/${token}`;
export const orderUrl = (token: string) => `${siteUrl}/orders/${token}`;

async function qrAttachment(code: string, filename = 'ticket-qr.png'): Promise<Attachment> {
  const dataUrl: string = await QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 2, width: 480 });
  return { filename, content: dataUrl.split(',')[1], content_id: 'ticket-qr' };
}

// Event tickets
export async function sendTicket(t: TicketDetails & { ticket_code: string }, token?: string) {
  const mail = ticketEmail(t, token ? statusUrl(token) : undefined);
  await send(t.guest_email, mail.subject, mail.html, mail.text, [await qrAttachment(t.ticket_code)]);
}

export async function sendWaitlisted(t: TicketDetails & { waitlist_position: number }, token: string) {
  const mail = waitlistEmail(t, statusUrl(token));
  await send(t.guest_email, mail.subject, mail.html, mail.text);
}

export async function sendStatusLink(t: TicketDetails & { ticket_code?: string | null; status: string }, token: string) {
  const mail = statusLinkEmail(t, statusUrl(token));
  const attachments = t.status === 'registered' && t.ticket_code ? [await qrAttachment(t.ticket_code)] : [];
  await send(t.guest_email, mail.subject, mail.html, mail.text, attachments);
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

export async function sendPlain(to: string, subject: string, text: string) {
  await send(to, subject, `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`, text);
}
