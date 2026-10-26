// Public forms for guests: no login (FR-2.2).
//   Events
//   POST { action: 'register', event_id, name, email, phone?, answers?, consent: true, turnstile_token }
//   POST { action: 'resend',   event_id, email, turnstile_token }
//   POST { action: 'cancel',   status_token }
//   Contact
//   POST { action: 'inquiry',  kind: 'partner'|'contact', name, email, phone?, company?, message, consent: true, turnstile_token }
//   Uploads (CV or payment screenshot): returns a one-time signed upload link
//   POST { action: 'upload_url', kind: 'cv', cycle_id, turnstile_token } | { action: 'upload_url', kind: 'proof', status_token, ext }
//   Recruitment (FR-4)
//   POST { action: 'apply', cycle_id, name, email, phone?, team_ids, answers?, cv_path?, consent: true, turnstile_token }
//   Packages (FR-16)
//   POST { action: 'submit_proof', status_token, proof_path?, reference? }
//   POST { action: 'cancel_order', status_token }
//
// Status pages call get_registration_by_token / get_application_by_token /
// get_order_by_token, book_interview_slot and withdraw_application
// directly with the public key: those need only the private token.
import { admin } from '../_shared/clients.ts';
import { clientIp, fromDbError, handle, HttpError, json } from '../_shared/http.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { registrationErrors, cleanRegistrationAnswers, guestTypeFor } from '../_shared/event-registration.ts';
import {
  sendApplicationNotice, sendPlain, sendStatusLink, sendTicket, sendWaitlisted,
} from '../_shared/email.ts';

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function limit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin.rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(429, 'too_many_requests', 'Too many attempts. Please wait a few minutes and try again.');
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function requireConsent(body: Record<string, unknown>) {
  if (body.consent !== true) {
    throw new HttpError(400, 'consent_required', 'Please agree to the privacy notice to continue.');
  }
}

Deno.serve(handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const ip = clientIp(req);
  await limit(`ip:${ip}`, 30, 600);

  switch (body.action) {
    case 'register': {
      requireConsent(body);
      await verifyTurnstile(str(body.turnstile_token, 2048), ip);
      const registrationIssues = registrationErrors(body);
      if (Object.keys(registrationIssues).length) throw new HttpError(400, 'invalid_form', Object.values(registrationIssues)[0]);
      const registrationAnswers = cleanRegistrationAnswers(body.answers as Record<string, string>);
      const email = str(body.email, 254).toLowerCase();
      await limit(`email:${email}`, 5, 3600);
      const { data, error } = await admin.rpc('register_for_event', {
        p_event_id: str(body.event_id, 64),
        p_name: str(body.name, 120),
        p_email: email,
        p_phone: str(body.phone, 30) || null,
        p_answers: registrationAnswers,
        p_guest_type: guestTypeFor(registrationAnswers.guest_category),
      });
      if (error) throw fromDbError(error);
      if (data.status === 'registered') await sendTicket(data, data.status_token);
      else await sendWaitlisted(data, data.status_token);
      return json({
        status: data.status,
        ticket_no: data.ticket_no,
        waitlist_position: data.waitlist_position,
        status_token: data.status_token,
      });
    }

    case 'resend': {
      await verifyTurnstile(str(body.turnstile_token, 2048), ip);
      const email = str(body.email, 254).toLowerCase();
      await limit(`resend:${email}`, 3, 3600);
      const { data, error } = await admin.rpc('reissue_status_link', { p_event_id: str(body.event_id, 64), p_email: email });
      if (error) throw fromDbError(error);
      if (data) await sendStatusLink(data, data.status_token);
      // Same answer either way, so nobody can test which emails registered.
      return json({ ok: true, message: 'If this email is registered, we have sent the ticket again.' });
    }

    case 'cancel': {
      const { data, error } = await admin.rpc('cancel_registration', { p_status_token: str(body.status_token, 128) });
      if (error) throw fromDbError(error);
      if (data.promoted) await sendTicket(data.promoted);
      return json({ ok: true });
    }

    case 'inquiry': {
      requireConsent(body);
      await verifyTurnstile(str(body.turnstile_token, 2048), ip);
      const kind = body.kind === 'partner' ? 'partner' : 'contact';
      const row = {
        kind,
        name: str(body.name, 120),
        email: str(body.email, 254).toLowerCase(),
        phone: str(body.phone, 30) || null,
        company: str(body.company, 160) || null,
        message: str(body.message, 4000),
        consent_at: new Date().toISOString(),
      };
      if (!row.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email) || !row.message) {
        throw new HttpError(400, 'invalid_form', 'Please fill in your name, a valid email and a message.');
      }
      await limit(`inquiry:${row.email}`, 3, 3600);
      const { error } = await admin.from('inquiries').insert(row);
      if (error) throw fromDbError(error);
      const inbox = Deno.env.get('INQUIRY_INBOX');
      if (inbox) {
        await sendPlain(inbox, `New ${kind} message from ${row.name}`,
          `${row.name} <${row.email}>${row.company ? ` · ${row.company}` : ''}\n\n${row.message}`);
      }
      return json({ ok: true });
    }

    case 'upload_url': {
      let bucket: string;
      let path: string;
      if (body.kind === 'cv') {
        await verifyTurnstile(str(body.turnstile_token, 2048), ip);
        const cycleId = str(body.cycle_id, 64);
        if (!uuidRe.test(cycleId)) throw new HttpError(400, 'invalid_cycle');
        bucket = 'applications';
        path = `cv/${cycleId}/${crypto.randomUUID()}.pdf`;
      } else if (body.kind === 'proof') {
        // Only someone holding an order's private link may upload a proof.
        const { data: order } = await admin.rpc('get_order_by_token', { p_status_token: str(body.status_token, 128) });
        if (!order || !['pending_proof', 'pending_approval'].includes(order.status)) {
          throw new HttpError(404, 'not_found', 'We could not find an order waiting for payment.');
        }
        const ext = ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(String(body.ext)) ? String(body.ext) : 'jpg';
        bucket = 'payment-proofs';
        path = `proofs/${crypto.randomUUID()}.${ext}`;
      } else {
        throw new HttpError(400, 'unknown_upload');
      }
      await limit(`upload:${ip}`, 10, 3600);
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw new HttpError(500, 'upload_failed', 'Could not prepare the upload. Please try again.');
      // The page uploads with supabase.storage.from(bucket).uploadToSignedUrl(path, token, file).
      return json({ bucket, path, token: data.token });
    }

    case 'apply': {
      requireConsent(body);
      await verifyTurnstile(str(body.turnstile_token, 2048), ip);
      const email = str(body.email, 254).toLowerCase();
      await limit(`apply:${email}`, 3, 3600);
      const teamIds = Array.isArray(body.team_ids) ? body.team_ids.map((t) => str(t, 64)).filter((t) => uuidRe.test(t)) : [];
      const { data, error } = await admin.rpc('submit_application', {
        p_cycle_id: str(body.cycle_id, 64),
        p_name: str(body.name, 120),
        p_email: email,
        p_phone: str(body.phone, 30) || null,
        p_team_choices: teamIds,
        p_answers: typeof body.answers === 'object' && body.answers ? body.answers : {},
        p_cv_path: str(body.cv_path, 200) || null,
      });
      if (error) throw fromDbError(error);
      await sendApplicationNotice({ ...data, stage: 'applied' }, data.status_token);
      return json({ ok: true, status_token: data.status_token });
    }

    // Sign-ups (packages, trips) are member-only now: members call
    // member_sign_up() from the portal. Proof upload and cancel stay here
    // because they work from the order's private link.
    case 'submit_proof': {
      const { data, error } = await admin.rpc('submit_payment_proof', {
        p_status_token: str(body.status_token, 128),
        p_proof_path: str(body.proof_path, 200) || null,
        p_reference: str(body.reference, 100) || null,
      });
      if (error) throw fromDbError(error);
      return json(data);
    }

    case 'cancel_order': {
      const { error } = await admin.rpc('cancel_order', { p_status_token: str(body.status_token, 128) });
      if (error) throw fromDbError(error);
      return json({ ok: true });
    }

    default:
      throw new HttpError(400, 'unknown_action');
  }
}));
