// Events, guest registration, waitlist, tickets, check-in (online + offline).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, opsCurator, mediaExec, mediaAssoc, lpAssoc, coachingAssoc, talksCurator;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  opsCurator = await db.member('curator', 'operations');
  talksCurator = await db.member('curator', 'talks');
  mediaExec = await db.member('executive', 'media_design');
  mediaAssoc = await db.member('associate', 'media_design');
  lpAssoc = await db.member('associate', 'logistics_planning');
  coachingAssoc = await db.member('associate', 'coaching');
});

// An open, licensed, public event created by the Operations Curator.
async function newEvent(capacity = 2, extra = {}) {
  return db.as(opsCurator, ({ one }) => one(
    `insert into events (type, title, starts_at, capacity, license_status, status, ticket_prefix, is_public)
     values ($1, $2, now() + interval '30 days', $3, $4, $5, 'SAL27', $6) returning *`,
    [extra.type ?? 'salon', extra.title ?? 'Salon', capacity, extra.license ?? 'licensed',
     extra.status ?? 'published', extra.is_public ?? true]));
}

const register = (eventId, email, name = 'Guest') =>
  db.as('service', ({ one }) => one(
    `select register_for_event($1, $2, $3, '01000000000', $4) as r`, [eventId, name, email,
      { gucian: 'Yes', guc_id: '58-1234', guest_category: 'Attendee', referral_source: 'University' }])).then((x) => x.r);

test('executives cannot create events', async () => {
  await rejects(db.as(mediaExec, ({ q }) => q(
    `insert into events (type, title, starts_at) values ('salon', 'x', now())`)), /row-level security/);
  const e = await newEvent();
  assert.equal(e.title, 'Salon');
});

test('Chairman and every Curator can create, edit and delete event setup', async () => {
  const managers = [chairman, opsCurator, talksCurator];
  for (const division of ['marketing', 'org_development']) managers.push(await db.member('curator', division));
  for (const manager of managers) {
    await db.as(manager, async ({ one, q }) => {
      const event = await one(`insert into events (type, title, starts_at) values ('workshop', 'Draft', now() + interval '30 days') returning id`);
      const updated = await one(`update events set title = 'Edited', status = 'published', license_status = 'not_required', cover_url = '/cover.png', agenda = '[{"title":"Welcome"}]' where id = $1 returning title`, [event.id]);
      assert.equal(updated.title, 'Edited');
      const field = await one(`insert into event_fields (event_id, label) values ($1, 'Question') returning id`, [event.id]);
      await q(`update event_fields set label = 'Edited question' where id = $1`, [field.id]);
      await q(`delete from event_fields where id = $1`, [field.id]);
      await q(`insert into event_staff (event_id, user_id) values ($1, $2)`, [event.id, mediaAssoc]);
      await q(`delete from event_staff where event_id = $1`, [event.id]);
      const speaker = await one(`insert into speakers (event_id, name) values ($1, 'Speaker') returning id`, [event.id]);
      await q(`update speakers set name = 'Edited speaker' where id = $1`, [speaker.id]);
      await q(`delete from speakers where id = $1`, [speaker.id]);
      await q(`insert into run_of_show (event_id, starts_at, item) values ($1, now(), 'Doors')`, [event.id]);
      await q(`delete from run_of_show where event_id = $1`, [event.id]);
      assert.equal((await q(`delete from events where id = $1 returning id`, [event.id])).length, 1);
    });
  }
});

test('guests see only published, licensed, public events (FR-1.8)', async () => {
  await newEvent(10, { title: 'Unlicensed', license: 'pending' });
  await newEvent(10, { title: 'Draft', status: 'draft' });
  await newEvent(10, { title: 'Internal', is_public: false, type: 'workshop', license: 'not_required' });
  const titles = (await db.as('anon', ({ q }) => q(`select title from events`))).map((r) => r.title);
  assert.ok(titles.includes('Salon'));
  assert.ok(!titles.includes('Unlicensed') && !titles.includes('Draft') && !titles.includes('Internal'));
  const memberTitles = (await db.as(mediaAssoc, ({ q }) => q(`select title from events`))).map((r) => r.title);
  assert.ok(memberTitles.includes('Internal') && memberTitles.includes('Unlicensed'));
  assert.ok(!memberTitles.includes('Draft'));
});

test('a Main Event or Salon cannot skip licensing', async () => {
  await rejects(newEvent(10, { license: 'not_required' }), /check constraint/);
});

test('guests cannot register directly; only the server function can', async () => {
  const e = await newEvent();
  await rejects(db.as('anon', ({ q }) => q(`select register_for_event($1, 'x', 'x@y.co')`, [e.id])), /permission denied/);
  await rejects(db.as('anon', ({ q }) => q(`insert into registrations (event_id) values ($1)`, [e.id])), /permission denied/);
});

test('register → ticket; full → waitlist; cancel → waitlist promoted (FR-5.2, FR-5.3)', async () => {
  const e = await newEvent(2);
  const a = await register(e.id, 'A@Example.com', 'Amira');
  const b = await register(e.id, 'b@example.com', 'Bassel');
  const c = await register(e.id, 'c@example.com', 'Cyrine');
  assert.equal(a.status, 'registered');
  assert.equal(a.ticket_no, 'SAL27-0001');
  assert.equal(b.ticket_no, 'SAL27-0002');
  assert.equal(a.guest_email, 'a@example.com');
  assert.match(a.ticket_code, /^[0-9a-f]{32}$/);
  assert.match(a.status_token, /^[0-9a-f]{64}$/);
  assert.equal(c.status, 'waitlisted');
  assert.equal(c.ticket_code, null);
  assert.equal(c.waitlist_position, 1);

  await rejects(register(e.id, 'a@example.com'), /already_registered/);

  // Status page works for guests with their token, and only shows their own registration.
  const status = await db.as('anon', ({ one }) => one(`select get_registration_by_token($1) as r`, [c.status_token])).then((x) => x.r);
  assert.equal(status.status, 'waitlisted');
  assert.equal(status.waitlist_position, 1);
  const none = await db.as('anon', ({ one }) => one(`select get_registration_by_token('wrong') as r`)).then((x) => x.r);
  assert.equal(none, null);

  // Amira cancels; Cyrine gets the seat and a new ticket.
  const res = await db.as('service', ({ one }) => one(`select cancel_registration($1) as r`, [a.status_token])).then((x) => x.r);
  assert.equal(res.promoted.guest_email, 'c@example.com');
  assert.equal(res.promoted.ticket_no, 'SAL27-0003');
  const after = await db.as('anon', ({ one }) => one(`select get_registration_by_token($1) as r`, [c.status_token])).then((x) => x.r);
  assert.equal(after.status, 'registered');
  assert.equal(after.ticket_code, res.promoted.ticket_code);

  // Amira can register again after cancelling.
  const again = await register(e.id, 'a@example.com');
  assert.equal(again.status, 'waitlisted');
});

test('raising capacity fills seats from the waitlist', async () => {
  const e = await newEvent(1);
  await register(e.id, 'p1@example.com');
  await register(e.id, 'p2@example.com');
  await register(e.id, 'p3@example.com');
  await db.as(opsCurator, ({ q }) => q(`update events set capacity = 3 where id = $1`, [e.id]));
  const promoted = await db.as(opsCurator, ({ one }) => one(`select promote_waitlist($1) as r`, [e.id])).then((x) => x.r);
  assert.deepEqual(promoted.map((p) => p.guest_email), ['p2@example.com', 'p3@example.com']);
  await rejects(db.as(mediaAssoc, ({ q }) => q(`select promote_waitlist($1)`, [e.id])), /not_allowed/);
});

test('registration rejects closed events, bad emails and missing required answers', async () => {
  const closed = await newEvent(5, { status: 'draft' });
  await rejects(register(closed.id, 'x@example.com'), /event_not_open/);
  const e = await newEvent(5);
  await rejects(register(e.id, 'not-an-email'), /invalid_email/);
  const field = await db.as(opsCurator, ({ one }) => one(
    `insert into event_fields (event_id, label, required) values ($1, 'University', true) returning id`, [e.id]));
  await rejects(register(e.id, 'y@example.com'), /missing_field/);
  const ok = await db.as('service', ({ one }) => one(
    `select register_for_event($1, 'Y', 'y@example.com', '01000000000', $2) as r`, [e.id, { gucian: 'Yes', guc_id: '58-1234', guest_category: 'Attendee', referral_source: 'University', [field.id]: 'GUC' }])).then((x) => x.r);
  assert.equal(ok.status, 'registered');
});

test('guest data is visible to Operations leadership only, and ticket codes to nobody', async () => {
  const e = await newEvent(5);
  await register(e.id, 'priv@example.com');
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select id from registrations where event_id = $1`, [e.id]))).length, 0);
  assert.equal((await db.as(opsCurator, ({ q }) => q(`select guest_phone from registrations where event_id = $1`, [e.id]))).length, 1);
  await rejects(db.as(opsCurator, ({ q }) => q(`select ticket_code from registrations`)), /permission denied/);
  await rejects(db.as(chairman, ({ q }) => q(`select status_token_hash from registrations`)), /permission denied/);
});

test('check-in: scan once, second scan is flagged, unknown and cancelled tickets rejected (FR-5.4)', async () => {
  const e = await newEvent(5);
  const t = await register(e.id, 'door@example.com', 'Dina');
  // L&P Associates scan on event day only.
  await rejects(db.as(lpAssoc, ({ q }) => q(`select check_in($1, $2)`, [e.id, t.ticket_code])), /not_allowed/);
  await db.q(`update events set starts_at = (date_trunc('day', now() at time zone 'Africa/Cairo') + interval '23 hours 58 minutes') at time zone 'Africa/Cairo' where id = $1`, [e.id]);
  const scan = (who, code) => db.as(who, ({ one }) => one(`select check_in($1, $2) as r`, [e.id, code])).then((x) => x.r);

  const first = await scan(lpAssoc, t.ticket_code);
  assert.equal(first.result, 'ok');
  assert.equal(first.guest_name, 'Dina');
  await rejects(scan(mediaExec, t.ticket_code), /not_allowed/);
  const second = await scan(opsCurator, t.ticket_code);
  assert.equal(second.result, 'already_checked_in');
  assert.equal((await scan(lpAssoc, 'deadbeef')).result, 'not_found');

  const t2 = await register(e.id, 'gone@example.com');
  await db.as('service', ({ q }) => q(`select cancel_registration($1)`, [t2.status_token]));
  assert.equal((await scan(lpAssoc, t2.ticket_code)).result, 'cancelled');

  const stats = await db.as(lpAssoc, ({ one }) => one(`select event_stats($1) as r`, [e.id])).then((x) => x.r);
  assert.deepEqual(stats, { capacity: 5, registered: 1, waitlisted: 0, cancelled: 1, checked_in: 1 });
  const log = await db.as(opsCurator, ({ q }) => q(`select result from checkin_scans where event_id = $1 order by id`, [e.id]));
  assert.deepEqual(log.map((r) => r.result), ['ok', 'already_checked_in', 'not_found', 'cancelled']);
});

test('check-in: Associates outside Operations need to be assigned as staff', async () => {
  const e = await newEvent(5);
  const t = await register(e.id, 'staff@example.com');
  await rejects(db.as(coachingAssoc, ({ q }) => q(`select check_in($1, $2)`, [e.id, t.ticket_code])), /not_allowed/);
  await db.as(opsCurator, ({ q }) => q(`insert into event_staff (event_id, user_id) values ($1, $2)`, [e.id, coachingAssoc]));
  const r = await db.as(coachingAssoc, ({ one }) => one(`select check_in($1, $2) as r`, [e.id, t.ticket_code])).then((x) => x.r);
  assert.equal(r.result, 'ok');
  await rejects(db.as('anon', ({ q }) => q(`select check_in($1, $2)`, [e.id, t.ticket_code])), /permission denied/);
});

test('manual lookup masks emails (FR-5.8)', async () => {
  const e = await newEvent(5);
  await register(e.id, 'mona.k@example.com', 'Mona Kamal');
  await db.q(`update events set starts_at = (date_trunc('day', now() at time zone 'Africa/Cairo') + interval '23 hours 58 minutes') at time zone 'Africa/Cairo' where id = $1`, [e.id]);
  const rows = await db.as(lpAssoc, ({ q }) => q(`select * from search_registrations($1, 'mona')`, [e.id]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email_hint, 'mo***@example.com');
  const r = await db.as(lpAssoc, ({ one }) => one(`select check_in_registration($1) as r`, [rows[0].registration_id])).then((x) => x.r);
  assert.equal(r.result, 'ok');
});

test('offline: manifest has hashes only; sync applies first scan and flags duplicates (FR-5.7)', async () => {
  const e = await newEvent(10);
  await db.q(`update events set starts_at = (date_trunc('day', now() at time zone 'Africa/Cairo') + interval '23 hours 58 minutes') at time zone 'Africa/Cairo' where id = $1`, [e.id]);
  const x = await register(e.id, 'x@example.com', 'Xena');
  const y = await register(e.id, 'y@example.com', 'Yara');

  const manifest = await db.as(lpAssoc, ({ q }) => q(`select * from get_checkin_manifest($1)`, [e.id]));
  assert.equal(manifest.length, 2);
  assert.ok(!('ticket_code' in manifest[0]));
  // A device can match a scanned code to the manifest by hashing it.
  const { createHash } = await import('node:crypto');
  const h = createHash('sha256').update(x.ticket_code).digest('hex');
  assert.ok(manifest.some((m) => m.ticket_code_hash === h));

  // Two doors scanned Xena offline; door-2 was first.
  const scans = [
    { ticket_code: x.ticket_code, scanned_at: new Date(Date.now() - 60_000).toISOString(), device_id: 'door-1' },
    { ticket_code: x.ticket_code, scanned_at: new Date(Date.now() - 120_000).toISOString(), device_id: 'door-2' },
    { ticket_code: y.ticket_code, scanned_at: new Date(Date.now() - 30_000).toISOString(), device_id: 'door-1' },
    { ticket_code: 'forged', scanned_at: new Date().toISOString(), device_id: 'door-1' },
  ];
  const res = await db.as(lpAssoc, ({ one }) => one(`select sync_offline_checkins($1, $2) as r`, [e.id, JSON.stringify(scans)])).then((x) => x.r);
  const byIndex = Object.fromEntries(res.map((r) => [r.index, r.result]));
  assert.deepEqual(byIndex, { 0: 'already_checked_in', 1: 'ok', 2: 'ok', 3: 'not_found' });

  const reg = await db.as(opsCurator, ({ one }) => one(
    `select checked_in_offline, checked_in_at from registrations where guest_email = 'x@example.com' and event_id = $1`, [e.id]));
  assert.equal(reg.checked_in_offline, true);
  assert.ok(new Date(reg.checked_in_at) < new Date(Date.now() - 100_000), 'keeps the earliest scan time');
});

test('resend ticket issues a new status link and kills the old one', async () => {
  const e = await newEvent(5);
  const t = await register(e.id, 'lost@example.com');
  const re = await db.as('service', ({ one }) => one(`select reissue_status_link($1, 'LOST@example.com') as r`, [e.id])).then((x) => x.r);
  assert.equal(re.ticket_code, t.ticket_code);
  assert.notEqual(re.status_token, t.status_token);
  const old = await db.as('anon', ({ one }) => one(`select get_registration_by_token($1) as r`, [t.status_token])).then((x) => x.r);
  assert.equal(old, null);
  const nobody = await db.as('service', ({ one }) => one(`select reissue_status_link($1, 'nobody@example.com') as r`, [e.id])).then((x) => x.r);
  assert.equal(nobody, null);
});

test('run of show: L&P Executives edit, other members read', async () => {
  const e = await newEvent(5);
  const lpExec = await db.member('executive', 'logistics_planning');
  await db.as(lpExec, ({ q }) => q(`insert into run_of_show (event_id, starts_at, item) values ($1, now(), 'Doors open')`, [e.id]));
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into run_of_show (event_id, starts_at, item) values ($1, now(), 'x')`, [e.id])), /row-level security/);
  assert.equal((await db.as(mediaAssoc, ({ q }) => q(`select item from run_of_show where event_id = $1`, [e.id]))).length, 1);
});

test('all Curators can announce events to the whole club', async () => {
  const season = (await db.one(`select id from seasons where is_active`)).id;
  await db.as(opsCurator, ({ q }) => q(`insert into announcements (season_id, audience_type, title, body) values ($1, 'all', 'Salon on Thursday', 'Internal event')`, [season]));
  await db.as(talksCurator, ({ q }) => q(`insert into announcements (season_id, audience_type, title, body) values ($1, 'all', 'x', 'y')`, [season]));
});

const pdfAnswers = (extra = {}) => ({ gucian: 'Yes', guc_id: '58-1234', guest_category: 'Attendee', referral_source: 'University', ...extra });
const registerPdf = (eventId, email, answers, phone = '+20 100 000 0000', suppliedType = 'attendee') =>
  db.as('service', ({ one }) => one(`select register_for_event($1, 'PDF Guest', $2, $3, $4, $5) as r`, [eventId, email, phone, answers, suppliedType])).then((x) => x.r);

test('PDF registration enforces identity branches, contact details, referral and exact guest choices in the database', async () => {
  const e = await newEvent(20);
  for (const [extra, message] of [
    [{ gucian: '' }, /missing_gucian/], [{ guc_id: '' }, /missing_guc_id/],
    [{ gucian: 'No' }, /missing_national_id/], [{ guest_category: 'VIP' }, /invalid_guest_category/],
    [{ guest_category: '' }, /invalid_guest_category/], [{ referral_source: '' }, /missing_referral_source/],
    [{ referral_source: 'Other' }, /missing_referral_other/],
  ]) await rejects(registerPdf(e.id, 'invalid@example.com', pdfAnswers(extra)), message);
  await rejects(registerPdf(e.id, 'invalid@example.com', pdfAnswers(), ''), /invalid_phone/);
  await rejects(registerPdf(e.id, 'invalid@example.com', pdfAnswers({ malformed: {} })), /invalid_registration_answers/);
  await rejects(registerPdf(e.id, 'invalid@example.com', []), /invalid_registration_answers/);
  const nonGuc = await registerPdf(e.id, 'nonguc@example.com', pdfAnswers({ gucian: 'No', national_id: '12345678901234', referral_source: 'Other', referral_other: 'A friend' }));
  assert.equal(nonGuc.status, 'registered', 'an ID photo is never required');
  const stored = await db.as(opsCurator, ({ one }) => one(`select answers from registrations where id = $1`, [nonGuc.registration_id]));
  assert.equal(stored.answers.guc_id, undefined, 'inactive branch is removed');
  assert.equal(stored.answers.national_id, '12345678901234');
});

test('PDF guest category controls Regular/VIP across storage, private ticket, resends, check-in and manifest', async () => {
  const e = await newEvent(20);
  const categories = ['Attendee', "Speaker's Family", 'Ex-Board', 'Board Member Family', 'Sponsor'];
  for (const [i, category] of categories.entries()) {
    const expected = category === 'Attendee' ? 'attendee' : 'vip';
    const registered = await registerPdf(e.id, `category${i}@example.com`, pdfAnswers({ guest_category: category }), '+20 100 000 0000', expected === 'vip' ? 'attendee' : 'vip');
    assert.equal(registered.guest_type, expected, 'caller cannot override the category classification');
    const privateView = await db.as('anon', ({ one }) => one(`select get_registration_by_token($1) as r`, [registered.status_token])).then((x) => x.r);
    assert.equal(privateView.guest_type, expected);
    assert.equal(privateView.answers, undefined, 'identity answers are not included in ticket links');
    const resent = await db.as('service', ({ one }) => one(`select reissue_status_link($1, $2) as r`, [e.id, `category${i}@example.com`])).then((x) => x.r);
    assert.equal(resent.guest_type, expected);
    const checked = await db.as(opsCurator, ({ one }) => one(`select check_in($1, $2) as r`, [e.id, registered.ticket_code])).then((x) => x.r);
    assert.equal(checked.guest_type, expected);
  }
  const stored = await db.as(opsCurator, ({ q }) => q(`select guest_type, answers from registrations where event_id = $1`, [e.id]));
  assert.equal(stored.filter((r) => r.guest_type === 'vip').length, 4);
  const manifest = await db.as(opsCurator, ({ q }) => q(`select * from get_checkin_manifest($1)`, [e.id]));
  assert.equal(manifest.filter((r) => r.guest_type === 'vip').length, 4);
  assert.equal(manifest.filter((r) => r.guest_type === 'attendee').length, 1);
  assert.ok(manifest.every((r) => !('answers' in r) && !('national_id' in r)));
  assert.equal((await db.as(mediaAssoc, ({ q }) => q(`select answers from registrations where event_id = $1`, [e.id]))).length, 0);
  await rejects(db.as('anon', ({ q }) => q(`select answers from registrations where event_id = $1`, [e.id])), /permission denied/);
});

test('VIP remains VIP when promoted from the waitlist', async () => {
  const e = await newEvent(1);
  const first = await register(e.id, 'first-tier@example.com');
  const waiting = await registerPdf(e.id, 'vip-wait@example.com', pdfAnswers({ guest_category: 'Sponsor' }));
  assert.equal(waiting.status, 'waitlisted');
  assert.equal(waiting.guest_type, 'vip');
  const cancelled = await db.as('service', ({ one }) => one(`select cancel_registration($1) as r`, [first.status_token])).then((x) => x.r);
  assert.equal(cancelled.promoted.guest_type, 'vip');
  const ticket = await db.as('anon', ({ one }) => one(`select get_registration_by_token($1) as r`, [waiting.status_token])).then((x) => x.r);
  assert.equal(ticket.status, 'registered');
  assert.equal(ticket.guest_type, 'vip');
});
