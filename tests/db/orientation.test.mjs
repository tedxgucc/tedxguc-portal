import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';
let db, cycle, day1, day2, md, coach, chair, mdExec, coachExec;
const sign = (day, guc, email, teams, name = 'Student') => db.as('service', ({ one }) => one(`select sign_up_for_orientation($1,$2,$3,$4,$5) as r`, [day, name, guc, email, teams]));
before(async () => {
  db = await createDb(); chair = await db.member('chairman');
  md = await db.team('media_design'); coach = await db.team('coaching');
  mdExec = await db.member('executive', 'media_design'); coachExec = await db.member('executive', 'coaching');
  cycle = await db.one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('Next round',now()+interval '10 day',now()+interval '20 day') returning id`);
  day1 = (await db.one(`insert into orientation_days(cycle_id,starts_at,ends_at,capacity) values ($1,now()+interval '3 day',now()+interval '3 day 3 hour',2) returning id`, [cycle.id])).id;
  day2 = (await db.one(`insert into orientation_days(cycle_id,starts_at,ends_at) values ($1,now()+interval '4 day',now()+interval '4 day 3 hour') returning id`, [cycle.id])).id;
});

test('only GUC student emails and GUC IDs can sign up', async () => {
  await rejects(sign(day1, '58-12345', 'someone@gmail.com', [md]), /not_gucian/);
  await rejects(sign(day1, '12345', 'a.b@student.guc.edu.eg', [md]), /invalid_guc_id/);
  await rejects(sign(day1, '58-12345', 'a.b@student.guc.edu.eg', []), /invalid_orientation_teams/);
  const r = await sign(day1, '58-12345', 'A.B@student.guc.edu.eg', [md, coach]);
  assert.ok(r.r.starts_at);
});

test('one sign-up per GUC ID or email per round, and full days refuse', async () => {
  await rejects(sign(day2, '58-12345', 'other@student.guc.edu.eg', [md]), /already_signed_up/);
  await rejects(sign(day2, '58-99999', 'a.b@student.guc.edu.eg', [md]), /already_signed_up/);
  await sign(day1, '58-22222', 'c.d@student.guc.edu.eg', [coach]);
  await rejects(sign(day1, '58-33333', 'e.f@student.guc.edu.eg', [coach]), /orientation_full/);
  await sign(day2, '58-33333', 'e.f@student.guc.edu.eg', [coach]);
});

test('guests cannot sign up directly or read names; they see counts', async () => {
  await rejects(db.as('anon', ({ one }) => one(`select sign_up_for_orientation($1,'x','58-1','x@student.guc.edu.eg',$2)`, [day2, [md]])), /permission denied/);
  await rejects(db.as('anon', ({ q }) => q(`select * from orientation_signups`)), /permission denied/);
  const counts = await db.as('anon', ({ q }) => q(`select * from orientation_day_counts($1)`, [cycle.id]));
  assert.equal(counts.find((c) => c.day_id === day1).is_full, true);
});

test('executives see only students interested in their team; the Chairman sees all', async () => {
  const n = (who) => db.as(who, ({ one }) => one(`select count(*)::int n from orientation_signups`)).then((r) => r.n);
  assert.equal(await n(chair), 3);
  assert.equal(await n(mdExec), 1);
  assert.equal(await n(coachExec), 3);
  await rejects(db.as(mdExec, ({ q }) => q(`insert into orientation_days(cycle_id,starts_at,ends_at) values ($1,now(),now()+interval '1 hour')`, [cycle.id])), /row-level security/);
});
