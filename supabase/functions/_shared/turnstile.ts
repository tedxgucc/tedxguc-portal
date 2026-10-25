// Cloudflare Turnstile check for public forms (FR-1.9).
// Without TURNSTILE_SECRET_KEY (local development) every request passes.
import { HttpError } from './http.ts';

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return;
  if (!token) throw new HttpError(400, 'captcha_required', 'Please complete the security check.');

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip !== 'unknown') body.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = await res.json();
  if (!data.success) throw new HttpError(400, 'captcha_failed', 'The security check failed. Please try again.');
}
