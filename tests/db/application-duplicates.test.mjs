import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDb, rejects } from './harness.mjs';
let db, cycle, nextCycle, team;
const apply = (email, phone, round = cycle.id) => db.as('service', ({ one }) => one(`select submit_application($1,'Applicant',$2,$3,$4) as data`, [round, email, phone, [team]])).then((r) => r.data);
before(async () => {
  db = await createDb(); await db.member('chairman'); team = await db.team('media_design');
  cycle = await db.one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('First round',now()-interval '1 day',now()+interval '1 day') returning id`);
  nextCycle = await db.one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('Next round',now()-interval '1 day',now()+interval '1 day') returning id`);
  await db.q(`insert into positions(cycle_id,team_id) values ($1,$3),($2,$3)`, [cycle.id, nextCycle.id, team]);
});

test('either an existing email or a normalized phone prevents another application', async () => {
  await apply('First@Example.com', '010 1234 5678');
  await rejects(apply(' FIRST@example.com ', '01187654321'), /already_applied/);
  await rejects(apply('changed@example.com', '+20 (10) 1234-5678'), /already_applied/);
  await rejects(apply('changed2@example.com', '0020 10 1234 5678'), /already_applied/);
  await rejects(apply('changed3@example.com', '1012345678'), /already_applied/);
  assert.equal((await db.one(`select count(*)::int n from applications where cycle_id=$1`, [cycle.id])).n, 1);
});

test('withdrawal or any decision never releases the email or phone within the round', async () => {
  for (const [i, stage] of ['withdrawn', 'rejected', 'accepted'].entries()) {
    const email = `stage${i}@example.com`; const phone = `0110000000${i}`;
    const a = await apply(email, phone);
    await db.q(`update applications set stage=$1 where id=$2`, [stage, a.application_id]);
    await rejects(apply(email, `0120000000${i}`), /already_applied/);
    await rejects(apply(`different${i}@example.com`, phone), /already_applied/);
  }
});

test('the same person may apply in a different recruitment round', async () => {
  const a = await apply('first@example.com', '+201012345678', nextCycle.id);
  assert.ok(a.application_id);
});

test('direct inserts cannot bypass duplicate claims and failed submissions leave no claims', async () => {
  await rejects(db.q(`insert into applications(cycle_id,applicant_name,applicant_email,applicant_phone,team_choices,status_token_hash,consent_at)
    values ($1,'Bypass','new@example.com','+201012345678',$2,'duplicate-direct-token',now())`, [cycle.id, [team]]), /already_applied/);
  // An email used in a failed phone collision must remain available.
  assert.ok((await apply('changed@example.com', '01234567890')).application_id);
  const member = await db.member('associate', 'media_design');
  await rejects(db.as(member, ({ q }) => q(`select * from private.application_identity_claims`)), /permission denied/);
});

test('blank phone values do not collide and privacy deletion removes associated identity hashes', async () => {
  const a = await apply('no-phone1@example.com', null);
  await apply('no-phone2@example.com', '');
  const claim = await db.one(`select count(*)::int n from private.application_identity_claims where application_id=$1`, [a.application_id]);
  assert.equal(claim.n, 1);
  await db.q(`delete from applications where id=$1`, [a.application_id]);
  assert.equal((await db.one(`select count(*)::int n from private.application_identity_claims where application_id=$1`, [a.application_id])).n, 0);
});

test('migration preserves historical duplicates and protects their identities immediately', async () => {
  const legacy = await createDb('20261026000024_applicant_interview_booking.sql');
  const tid = await legacy.team('media_design');
  const round = await legacy.one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('Legacy round',now(),now()+interval '1 day') returning id`);
  await legacy.q(`insert into positions(cycle_id,team_id) values ($1,$2)`, [round.id, tid]);
  await legacy.q(`insert into applications(cycle_id,applicant_name,applicant_email,applicant_phone,team_choices,status_token_hash,consent_at,stage)
    values ($1,'First','legacy@example.com','01012345678',$2,'legacy-token-1',now(),'withdrawn'),
           ($1,'Second','legacy@example.com','+201012345678',$2,'legacy-token-2',now(),'applied')`, [round.id, [tid]]);
  await legacy.raw.exec(readFileSync(new URL('../../supabase/migrations/20261026000025_application_duplicates.sql', import.meta.url), 'utf8'));
  assert.equal((await legacy.one(`select count(*)::int n from applications`)).n, 2);
  await rejects(legacy.as('service', ({ q }) => q(`select submit_application($1,'Applicant','another@example.com','00201012345678',$2)`, [round.id, [tid]])), /already_applied/);
});
