import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';
let db, chair, executive, cycle, team, otherTeam, first, second, unavailable, wrongTeam, app, other;
const get = (token) => db.as('anon', ({ one }) => one(`select get_application_by_token($1) as data`, [token])).then((r) => r.data);
const book = (token, id) => db.as('anon', ({ q }) => q(`select book_interview_slot($1,$2)`, [token, id]));
let phoneCounter = 0;
const apply = (email) => db.as('service', ({ one }) => one(`select submit_application($1,'Applicant',$2,$4,$3) as data`, [cycle.id, email, [team], '+2010' + String(++phoneCounter).padStart(8, '0')])).then((r) => r.data);
before(async () => {
  db = await createDb(); chair = await db.member('chairman'); executive = await db.member('executive', 'media_design');
  team = await db.team('media_design'); otherTeam = await db.team('coaching');
  cycle = await db.as(chair, ({ one }) => one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('Immediate booking',now()-interval '1 day',now()+interval '10 days') returning id`));
  await db.q(`insert into positions(cycle_id,team_id) values ($1,$2)`, [cycle.id, team]);
  const slot = (days, tid = team) => db.q(`insert into interview_slots(cycle_id,team_id,starts_at,ends_at,interviewer_ids,location) values ($1,$2,now()+$3::interval,now()+$3::interval+interval '20 minutes',$4,'Room 201') returning id`, [cycle.id, tid, `${days} days`, [executive]]).then((r) => r[0]);
  first = await slot(2); second = await slot(3); wrongTeam = await slot(4, otherTeam); unavailable = await slot(0.01);
  app = await apply('immediate@example.invalid'); other = await apply('second@example.invalid');
});

test('new application immediately lists the correct team slots without board intervention', async () => {
  const a = await get(app.status_token);
  assert.equal(a.stage, 'received');
  assert.deepEqual(a.open_slots.map((s) => s.slot_id), [first.id, second.id]);
  await book(app.status_token, first.id);
  const confirmed = await get(app.status_token);
  assert.equal(confirmed.stage, 'interview');
  assert.equal(confirmed.interview.slot_id, first.id);
  assert.equal(confirmed.interview.location, 'Room 201');
  assert.ok(confirmed.interview.starts_at && confirmed.interview.ends_at && confirmed.interview.team);
});

test('taken, wrong-team and too-soon slots cannot replace a confirmed reservation', async () => {
  await rejects(book(other.status_token, first.id), /slot_taken/);
  await rejects(book(app.status_token, wrongTeam.id), /slot_not_found/);
  await rejects(book(app.status_token, unavailable.id), /slot_too_soon/);
  assert.equal((await get(app.status_token)).interview.slot_id, first.id);
  await book(app.status_token, second.id);
  assert.equal((await get(app.status_token)).interview.slot_id, second.id);
  await book(other.status_token, first.id);
});

test('rejected and withdrawn applications cannot book, while screened applications can', async () => {
  const rejected = await apply('rejected@example.invalid');
  await db.q(`update applications set stage='rejected' where id=$1`, [rejected.application_id]);
  assert.equal((await get(rejected.status_token)).open_slots, null);
  await rejects(book(rejected.status_token, wrongTeam.id), /not_invited_to_interview/);
  const withdrawn = await apply('withdrawn@example.invalid');
  await db.as('anon', ({ q }) => q(`select withdraw_application($1)`, [withdrawn.status_token]));
  assert.equal((await get(withdrawn.status_token)).open_slots, null);
  await rejects(book(withdrawn.status_token, second.id), /not_invited_to_interview/);
  const screened = await apply('screened@example.invalid');
  await db.q(`update applications set stage='screened' where id=$1`, [screened.application_id]);
  assert.ok(Array.isArray((await get(screened.status_token)).open_slots));
});

test('a private application token is required and slot tables stay hidden from guests', async () => {
  assert.equal(await get('invalid-token'), null);
  await rejects(book('invalid-token', first.id), /not_found/);
  await rejects(db.as('anon', ({ q }) => q(`select * from interview_slots`)), /permission denied/);
});
