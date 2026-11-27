// Renders every email to HTML files for a visual check (not deployed).
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as T from '../supabase/functions/_shared/templates.ts';
const require = createRequire(import.meta.url);
const QR = require(process.argv[3]);
const out = process.argv[2];
const qr = await QR.toDataURL('TX-DEMO-123', { margin: 2, width: 440 });
const t = { guest_name: 'Salma Hany', guest_email: 's@x', guest_type: 'vip', event_title: 'Loose Ends', starts_at: '2026-12-17T16:30:00Z', venue: 'GUC Main Hall, New Cairo', ticket_no: 'LE-0042' };
const o = { buyer_name: 'Omar Tarek', buyer_email: 'o@x', order_no: 'PKG-2027-0007', package_name: 'Loose Ends tee', total_egp: 450, quantity: 1, method: 'instapay' as const, payment_link: 'https://ipn.eg/S/tedxguc/instapay/demo', hold_expires_at: '2026-12-01T20:00:00Z', pickup_info: 'TEDxGUC booth, Building C' };
const a = { applicant_name: 'Nour Ali', applicant_email: 'n@x', cycle_name: 'Associates · Spring 2027', team: 'Media and Design' };
const notice = (subject: string, text: string, kicker: string) => {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let button; const i = paragraphs.findIndex((p) => /https?:\/\/\S+\s*$/.test(p));
  if (i >= 0) { const m = paragraphs[i].match(/^([\s\S]*?)(https?:\/\/\S+)\s*$/)!; const lead = m[1].replace(/[:\s]+$/, '').trim(); button = { label: /portal|log in|login|set up/i.test(lead + ' ' + m[2]) ? 'Open the portal' : 'Open link', url: m[2] }; if (lead.length > 30) paragraphs[i] = lead + '.'; else paragraphs.splice(i, 1); }
  return { subject, ...T.noticeEmail({ kicker, title: subject, paragraphs: paragraphs.map((p) => p.replace(/\n/g, ' ')), button }) };
};
const mails: Record<string, { subject: string; html: string }> = {
  '1-ticket': T.ticketEmail(t, 'https://tedxguc.org/tickets?t=demo'),
  '2-waitlist': T.waitlistEmail({ ...t, waitlist_position: 4 }, 'https://tedxguc.org/tickets?t=demo'),
  '3-ticket-again': T.statusLinkEmail({ ...t, status: 'registered' }, 'https://tedxguc.org/tickets?t=demo'),
  '4-applied': T.applicationEmail({ ...a, stage: 'applied' }, 'https://tedxguc.org/join/status?t=demo'),
  '5-interview': T.applicationEmail({ ...a, stage: 'interview' }, 'https://tedxguc.org/join/status?t=demo'),
  '6-accepted': T.applicationEmail({ ...a, stage: 'accepted' }, 'https://tedxguc.org/join/status?t=demo'),
  '7-rejected': T.applicationEmail({ ...a, stage: 'rejected' }),
  '8-order-placed': T.orderPlacedEmail(o, 'https://tedxguc.org/orders?t=demo'),
  '9-order-confirmed': T.orderConfirmedEmail(o, 'https://tedxguc.org/orders?t=demo'),
  '10-order-rejected': T.orderRejectedEmail({ ...o, reject_reason: 'The transfer amount did not match.' }),
  '11-invite': notice('You are invited to the TEDxGUC portal', `You have been added to this season's TEDxGUC team.\n\nOn the login page, tap "Set your password" and use this email address. The invite works for 7 days.

Log in here: https://tedxguc.org/login`, 'Portal invite'),
  '12-welcome': notice('Welcome to the TEDxGUC team', `Your team membership is active. Open your portal here:\nhttps://tedxguc.org/auth/callback#demo`, 'Welcome'),
  '13-orientation': notice('Your TEDxGUC orientation day', `Hi Kareem,\n\nYou're signed up for the TEDxGUC orientation on Wednesday 2 December, 12:00 at GUC, Building C, Hall C7.01.\n\nWe'll introduce TEDx, the club and every team. Bring your GUC ID.\n\nSee you there,\nTEDxGUC`, 'Orientation'),
  '14-contact': notice('New contact message from Mona Adel', `Mona Adel <mona@example.com> · Nile Bank\n\nHi! We'd love to sponsor your next event. Who should we talk to?`, 'Website message'),
};
const links: string[] = [];
for (const [k, m] of Object.entries(mails)) {
  writeFileSync(`${out}/${k}.html`, m.html.replaceAll('cid:ticket-qr', qr));
  links.push(`<li><a href="${k}.html" target="f">${k}</a> — ${m.subject}</li>`);
}
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset=utf-8><body style="margin:0;display:grid;grid-template-columns:320px 1fr;height:100vh;font:14px Arial"><ul style="padding:16px 24px;line-height:2;overflow:auto">${links.join('')}</ul><iframe name="f" src="1-ticket.html" style="border:0;width:100%;height:100%"></iframe></body>`);
console.log(Object.keys(mails).length, 'emails rendered');
