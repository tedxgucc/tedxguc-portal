// Builds the Supabase login-email templates as ticket-style cards: the red-dot
// stage on top (a hosted PNG from scripts/email-stage-art.mts), a dashed tear
// line, the message and a red button, and the black "Ideas worth spreading" band.
// Paste each file into Supabase → Authentication → Emails → Templates.
// node --experimental-strip-types scripts/email-auth-templates.mts <outDir>
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const SITE = 'https://tedxguc.org';
const URL = '{{ .ConfirmationURL }}';
const RED = '#e62b1e', INK = '#0c0c0c', GREY = '#3a3835', MUTED = '#8a8580', LINE = '#dedbd6', PAGE = '#eeece8';
const F = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type T = { subject: string; kicker: string; title: string; intro: string; button?: string; code?: boolean; after: string };
const TEMPLATES: Record<string, T> = {
  'reset-password': { subject: 'Reset your TEDxGUC portal password', kicker: 'Password reset', title: 'Choose a new password.', intro: 'Someone asked to reset the password for your TEDxGUC portal account. If that was you, tap the button to choose a new one.', button: 'Choose a new password', after: "Didn't ask for this? Ignore this email: your password stays the same." },
  'invite-user': { subject: "You're invited to the TEDxGUC portal", kicker: 'Portal invite', title: "You're on the team.", intro: "You've been added to this season's TEDxGUC team. Tap the button to set up your portal access.", button: 'Set up my account', after: 'The link works once and expires soon.' },
  'magic-link': { subject: 'Your TEDxGUC portal sign-in link', kicker: 'Sign in', title: 'Your sign-in link.', intro: 'Tap the button to sign in to the TEDxGUC portal.', button: 'Sign in', after: "The link works once. Didn't ask for it? Ignore this email." },
  'confirm-signup': { subject: 'Confirm your TEDxGUC portal email', kicker: 'Confirm your email', title: 'One last step.', intro: 'Tap the button to confirm your email and finish setting up your TEDxGUC portal account.', button: 'Confirm my email', after: "Didn't sign up? Ignore this email." },
  'change-email': { subject: 'Confirm your new email for the TEDxGUC portal', kicker: 'Email change', title: 'Confirm your new email.', intro: 'Tap the button to confirm the new email address for your TEDxGUC portal account.', button: 'Confirm new email', after: "Didn't ask for this? Tell the TEDxGUC board." },
  'reauthentication': { subject: 'Your TEDxGUC confirmation code', kicker: 'Confirmation code', title: 'Your code.', intro: 'Enter this code to confirm it’s you.', code: true, after: "Didn't ask for it? Ignore this email." },
};

export function card(name: string, t: T, url = URL, token = '{{ .Token }}') {
  const button = t.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0"><tr><td align="center" bgcolor="${RED}" style="border-radius:999px"><a href="${url}" style="display:inline-block;padding:15px 28px;font:700 16px/1.25 ${F};color:#ffffff;text-decoration:none;border-radius:999px">${esc(t.button)}&nbsp;&rarr;</a></td></tr></table>`
    : '';
  const code = t.code
    ? `<p style="margin:20px 0 0;padding:14px 18px;border:1px dashed ${LINE};border-radius:12px;font:700 30px/1 'Courier New',monospace;letter-spacing:.3em;color:${INK};text-align:center">${token}</p>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(t.title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${PAGE}" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px 32px">` +
    `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" align="center"><tr><td><![endif]-->` +
    // The ticket card
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="width:100%;max-width:480px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden">` +
    `<tr><td style="padding:0;font-size:0;line-height:0"><img src="${SITE}/brand/email/${name}.png" width="480" alt="TEDxGUC · ${esc(t.kicker)}" style="display:block;width:100%;max-width:480px;height:auto;border:0"></td></tr>` +
    `<tr><td style="padding:0 22px"><div style="border-top:2px dashed ${LINE};font-size:0;line-height:0;height:0">&nbsp;</div></td></tr>` +
    `<tr><td style="padding:22px 24px 26px">` +
    `<p style="margin:0;font:700 11px/1.3 ${F};letter-spacing:.16em;text-transform:uppercase;color:${MUTED}">${esc(t.kicker)}</p>` +
    `<h1 style="margin:8px 0 0;font:800 30px/1.05 ${F};letter-spacing:-.02em;color:${INK}">${esc(t.title)}</h1>` +
    `<p style="margin:14px 0 0;font:400 16px/1.6 ${F};color:${GREY}">${esc(t.intro)}</p>` +
    code + button +
    `<p style="margin:20px 0 0;font:400 13px/1.6 ${F};color:${MUTED}">${esc(t.after)}</p>` +
    `</td></tr>` +
    `<tr><td bgcolor="${INK}" style="background:${INK};padding:12px 22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
    `<td style="font:600 10px/1 ${F};letter-spacing:.18em;text-transform:uppercase;color:#ffffff">Ideas worth spreading</td>` +
    `<td align="right" style="font:600 10px/1 ${F};letter-spacing:.18em;text-transform:uppercase;color:#ffffff"><span style="color:${RED}">&#9679;</span>&nbsp;TEDxGUC</td>` +
    `</tr></table></td></tr></table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    // Under the card
    `<p style="margin:16px auto 0;max-width:480px;font:400 12px/1.6 ${F};color:${MUTED};text-align:center">This independent TEDxGUC event is operated under license from TED.<br><a href="${SITE}" style="color:${MUTED}">tedxguc.org</a> &middot; <a href="https://www.instagram.com/tedxguc__/" style="color:${MUTED}">@tedxguc__</a></p>` +
    `</td></tr></table></body></html>`;
}

if (out) {
  const list: string[] = [];
  for (const [k, v] of Object.entries(TEMPLATES)) {
    writeFileSync(`${out}/${k}.html`, card(k, v));
    list.push(`${k}.html  →  subject: ${v.subject}`);
  }
  writeFileSync(`${out}/README.txt`, 'Paste each file into Supabase → Authentication → Emails → Templates (project tedx_portal).\nSet the subject shown next to it.\n\n' + list.join('\n') + '\n');
  console.log(list.join('\n'));
}
