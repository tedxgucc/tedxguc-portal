// Account links that work on any device and in any email app.
// Supabase's default links finish sign-in with a secret kept in the browser that
// asked for them, so a link opened from the Gmail app (another browser) "expired".
// These links carry a one-time token hash instead; the site's /auth/confirm page
// verifies it only after the person taps Continue, so email scanners that pre-open
// links can't use it up.
import { admin } from './clients.ts';
import { HttpError } from './http.ts';

const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

export type LinkKind = 'invite' | 'recovery';

export function confirmUrl(tokenHash: string, type: LinkKind, next = '/auth/set-password') {
  const q = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${siteUrl}/auth/confirm?${q}`;
}

/**
 * A "set up / choose your password" link for this email.
 * New people get an invite link (creating the account applies their invite);
 * people who already have an account get a password link.
 */
export async function accountLink(email: string, fullName?: string): Promise<{ url: string; kind: LinkKind }> {
  const invite = await admin.auth.admin.generateLink({
    type: 'invite', email,
    options: { redirectTo: `${siteUrl}/auth/confirm`, ...(fullName ? { data: { full_name: fullName } } : {}) },
  });
  if (!invite.error) return { url: confirmUrl(invite.data.properties.hashed_token, 'invite'), kind: 'invite' };
  if (!/already|registered|exists/i.test(invite.error.message)) {
    console.error('Invite link failed', invite.error);
    throw new HttpError(502, 'link_failed', 'Could not create the setup link. Please try again.');
  }
  return { url: await passwordLink(email), kind: 'recovery' };
}

/** A "choose a new password" link for an existing account. */
export async function passwordLink(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${siteUrl}/auth/confirm` } });
  if (error) {
    console.error('Password link failed', error);
    throw new HttpError(502, 'link_failed', 'Could not create the password link. Please try again.');
  }
  return confirmUrl(data.properties.hashed_token, 'recovery');
}
