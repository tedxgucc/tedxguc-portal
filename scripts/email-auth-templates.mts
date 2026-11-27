// Builds the Supabase login-email templates in the TEDxGUC layout.
// Paste each file into Supabase → Authentication → Emails → Templates.
import { writeFileSync } from 'node:fs';
import { layout } from '../supabase/functions/_shared/templates.ts';
const out = process.argv[2];
const URL = '{{ .ConfirmationURL }}';
const T: Record<string, { subject: string; kicker: string; title: string; intro: string[]; button: string; after: string[] }> = {
  'reset-password': { subject: 'Reset your TEDxGUC portal password', kicker: 'Password reset', title: 'Choose a new password.', intro: ['Someone asked to reset the password for your TEDxGUC portal account. If that was you, tap the button to choose a new one.'], button: 'Choose a new password', after: ["If you didn't ask for this, ignore this email: your password stays the same."] },
  'invite-user': { subject: "You're invited to the TEDxGUC portal", kicker: 'Portal invite', title: "You're on the team.", intro: ["You've been added to this season's TEDxGUC team. Tap the button to set up your portal access."], button: 'Set up my account', after: ['The link works once and expires soon.'] },
  'magic-link': { subject: 'Your TEDxGUC portal sign-in link', kicker: 'Sign in', title: 'Your sign-in link.', intro: ['Tap the button to sign in to the TEDxGUC portal.'], button: 'Sign in', after: ["The link works once. If you didn't ask for it, ignore this email."] },
  'confirm-signup': { subject: 'Confirm your TEDxGUC portal email', kicker: 'Confirm your email', title: 'One last step.', intro: ['Tap the button to confirm your email and finish setting up your TEDxGUC portal account.'], button: 'Confirm my email', after: ["If you didn't sign up, ignore this email."] },
  'change-email': { subject: 'Confirm your new email for the TEDxGUC portal', kicker: 'Email change', title: 'Confirm your new email.', intro: ['Tap the button to confirm the new email address for your TEDxGUC portal account.'], button: 'Confirm new email', after: ["If you didn't ask for this, contact the TEDxGUC board."] },
  'reauthentication': { subject: 'Your TEDxGUC confirmation code', kicker: 'Confirmation code', title: 'Your code: {{ .Token }}', intro: ['Enter this code to confirm it’s you.'], button: '', after: ["If you didn't ask for it, ignore this email."] },
};
const list: string[] = [];
for (const [k, v] of Object.entries(T)) {
  const { html } = layout({ kicker: v.kicker, title: v.title, intro: v.intro, button: v.button ? { label: v.button, url: URL } : undefined, after: v.after });
  writeFileSync(`${out}/${k}.html`, html.replace('&#123;&#123;', '{{'));
  list.push(`${k}.html  →  subject: ${v.subject}`);
}
writeFileSync(`${out}/README.txt`, 'Paste each file into Supabase → Authentication → Emails → Templates (project qqgnvrjqrxafskkwxsvc).\nSet the subject shown next to it.\n\n' + list.join('\n') + '\n');
console.log(list.join('\n'));
