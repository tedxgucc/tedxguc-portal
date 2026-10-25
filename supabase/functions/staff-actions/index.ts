// Portal actions that also need to send email. Requires a logged-in
// member; permission checks run in the database as that member.
//   POST { action: 'send_invite', invite_id }
//   POST { action: 'admin_cancel', registration_id }
//   POST { action: 'promote_waitlist', event_id }
//   POST { action: 'application_stage', application_ids, stage }
//   POST { action: 'release_rejections', cycle_id }
//   POST { action: 'accept_application', application_id, team_id? }
//   POST { action: 'decide_order', order_id, approve, reason? }
//   POST { action: 'mark_cash_paid', order_id }
import { admin, asUser } from '../_shared/clients.ts';
import { fromDbError, handle, HttpError, json } from '../_shared/http.ts';
import {
  sendApplicationNotice, sendOrderConfirmed, sendOrderRejected, sendPlain, sendTicket,
} from '../_shared/email.ts';
import type { ApplicationNotice } from '../_shared/templates.ts';

const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

type Db = ReturnType<typeof asUser>;

// Email an invite (FR-2.3). The member can see the invite row only if
// they were allowed to create it, so that read is the permission check.
async function sendInvite(db: Db, inviteId: string) {
  const { data: invite, error } = await db.from('invites')
    .select('id, email, accepted_at, revoked_at, expires_at')
    .eq('id', inviteId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!invite) throw new HttpError(404, 'not_found', 'Invite not found.');
  if (invite.revoked_at || new Date(invite.expires_at) < new Date()) {
    throw new HttpError(409, 'invite_closed', 'This invite was revoked or has expired.');
  }
  if (invite.accepted_at) {
    // Returning member: the role was applied at once; just let them know.
    await sendPlain(invite.email, 'You have a new role in TEDxGUC',
      `You have been added to this season's team. Log in at ${siteUrl}/login to see your dashboard.`);
    return { existing_member: true };
  }
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });
  if (inviteError) {
    console.error('inviteUserByEmail failed', inviteError);
    throw new HttpError(502, 'invite_email_failed', 'The invite is saved, but the email could not be sent. Try again later.');
  }
  return { existing_member: false };
}

Deno.serve(handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const db = asUser(req);
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) throw new HttpError(401, 'login_required', 'Please log in again.');
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const s = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');

  switch (body.action) {
    case 'send_invite':
      return json({ ok: true, ...(await sendInvite(db, s('invite_id'))) });

    // ----- Events -----
    case 'admin_cancel': {
      const { data, error } = await db.rpc('admin_cancel_registration', { p_registration_id: s('registration_id') });
      if (error) throw fromDbError(error);
      if (data.promoted) await sendTicket(data.promoted);
      return json({ ok: true, promoted: data.promoted?.ticket_no ?? null });
    }

    case 'promote_waitlist': {
      const { data, error } = await db.rpc('promote_waitlist', { p_event_id: s('event_id') });
      if (error) throw fromDbError(error);
      for (const p of data) await sendTicket(p);
      return json({ ok: true, promoted: data.length });
    }

    // ----- Recruitment (FR-4.3, FR-4.5, FR-4.6) -----
    case 'application_stage': {
      const ids = Array.isArray(body.application_ids) ? body.application_ids : [];
      const { data, error } = await db.rpc('set_application_stage', { p_ids: ids, p_stage: s('stage') });
      if (error) throw fromDbError(error);
      for (const a of data as ApplicationNotice[]) await sendApplicationNotice(a);
      return json({ ok: true, emailed: data.length, held_back: ids.length - data.length });
    }

    case 'release_rejections': {
      const { data, error } = await db.rpc('release_rejections', { p_cycle_id: s('cycle_id') });
      if (error) throw fromDbError(error);
      for (const a of data as ApplicationNotice[]) await sendApplicationNotice(a);
      return json({ ok: true, emailed: data.length });
    }

    case 'accept_application': {
      const { data, error } = await db.rpc('accept_application', {
        p_application_id: s('application_id'), p_team_id: s('team_id') || null,
      });
      if (error) throw fromDbError(error);
      await sendApplicationNotice(data);
      const invite = await sendInvite(db, data.invite_id);
      return json({ ok: true, team: data.team, ...invite });
    }

    // ----- Package orders (FR-16.7) -----
    case 'decide_order': {
      const { data, error } = await db.rpc('decide_order', {
        p_order_id: s('order_id'), p_approve: body.approve === true, p_reason: s('reason') || null,
      });
      if (error) throw fromDbError(error);
      if (data.status === 'approved') await sendOrderConfirmed(data);
      else await sendOrderRejected(data);
      return json({ ok: true, status: data.status });
    }

    case 'mark_cash_paid': {
      const { data, error } = await db.rpc('mark_cash_paid', { p_order_id: s('order_id') });
      if (error) throw fromDbError(error);
      await sendOrderConfirmed(data);
      return json({ ok: true, status: data.status });
    }

    default:
      throw new HttpError(400, 'unknown_action');
  }
}));
