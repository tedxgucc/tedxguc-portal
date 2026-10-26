// Small HTTP helpers shared by the server functions.

const allowedOrigin = Deno.env.get('SITE_URL') ?? '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

// Database errors raised as `raise exception 'code'` → friendly HTTP errors.
const dbErrors: Record<string, [number, string]> = {
  invalid_registration_answers: [400, 'Some form answers are too long or invalid.'],
  missing_gucian: [400, 'Choose whether you are a GUCian.'],
  missing_guc_id: [400, 'Enter your GUC ID.'],
  missing_national_id: [400, 'Enter your national ID number.'],
  invalid_guest_category: [400, 'Choose your guest type.'],
  missing_referral_source: [400, 'Choose how you heard about TEDxGUC.'],
  missing_referral_other: [400, 'Tell us how you heard about TEDxGUC.'],
  event_not_open: [409, 'Registration for this event is closed.'],
  already_registered: [409, 'This email is already registered. Use "Resend my ticket" to get it again.'],
  invalid_email: [400, 'Please enter a valid email address.'],
  invalid_name: [400, 'Please enter your name.'],
  not_found: [404, 'We could not find that registration.'],
  already_cancelled: [409, 'This registration was already cancelled.'],
  already_checked_in: [409, 'This ticket was already used at the door.'],
  not_allowed: [403, 'You are not allowed to do this.'],
  // Recruitment
  cycle_not_open: [409, 'Applications for this round are closed.'],
  already_applied: [409, 'You already applied in this round. Check the link we emailed you.'],
  invalid_team_choices: [400, 'Pick one or two different teams.'],
  team_not_recruiting: [409, 'One of the teams you picked is not recruiting right now.'],
  invalid_cv: [400, 'Please upload your CV again (PDF only).'],
  // Packages
  package_not_on_sale: [409, 'This package is not on sale right now.'],
  sold_out: [409, 'Sorry, there are not enough packages left.'],
  invalid_quantity: [400, 'Please choose a valid quantity.'],
  invalid_phone: [400, 'Please enter a valid phone number.'],
  delivery_not_offered: [400, 'Delivery is not available for this package.'],
  order_not_awaiting_proof: [409, 'This order is not waiting for a payment screenshot.'],
  proof_required: [400, 'Upload the transfer screenshot or enter the transaction reference.'],
  invalid_proof: [400, 'Please upload the screenshot again.'],
  cannot_cancel: [409, 'This order can no longer be cancelled.'],
  order_not_pending: [409, 'This order is not waiting for approval.'],
  order_not_awaiting_cash: [409, 'This order is not waiting for cash payment.'],
  application_closed: [409, 'This application is already closed.'],
};

export function fromDbError(err: { message?: string; code?: string } | null): HttpError {
  const msg = err?.message ?? 'unknown';
  if (msg.startsWith('missing_field:')) {
    return new HttpError(400, 'missing_field', `Please answer: ${msg.slice('missing_field:'.length)}`);
  }
  const known = dbErrors[msg];
  if (known) return new HttpError(known[0], msg, known[1]);
  console.error('Unexpected database error', err);
  return new HttpError(500, 'server_error', 'Something went wrong. Please try again.');
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status);
      console.error(err);
      return json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
    }
  };
}
