// Account emails carry a 6-digit code instead of a sign-in link. The person types
// the code on the site, so it works from any email app or device, and email
// scanners that pre-open links can't use it up.
import { admin } from './clients.ts';
import { HttpError } from './http.ts';

const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

export type CodeKind = 'invite' | 'recovery';

/** The page where the code is typed, with the email filled in. */
export function codePage(email: string, type: CodeKind) {
  return `${siteUrl}/auth/code?${new URLSearchParams({ email, type })}`;
}

/**
 * A set-up code for this email. New people get an invite code (creating the
 * account applies their invite); people who already have an account get a
 * password code.
 */
export async function accountCode(email: string, fullName?: string): Promise<{ code: string; url: string; kind: CodeKind }> {
  const invite = await admin.auth.admin.generateLink({
    type: 'invite', email, ...(fullName ? { options: { data: { full_name: fullName } } } : {}),
  });
  if (!invite.error) return { code: invite.data.properties.email_otp, url: codePage(email, 'invite'), kind: 'invite' };
  if (!/already|registered|exists/i.test(invite.error.message)) {
    console.error('Invite code failed', invite.error);
    throw new HttpError(502, 'code_failed', 'Could not create the set-up code. Please try again.');
  }
  return { ...(await passwordCode(email)), kind: 'recovery' };
}

/** A "choose a new password" code for an existing account. */
export async function passwordCode(email: string): Promise<{ code: string; url: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error) {
    console.error('Password code failed', error);
    throw new HttpError(502, 'code_failed', 'Could not create the code. Please try again.');
  }
  return { code: data.properties.email_otp, url: codePage(email, 'recovery') };
}
