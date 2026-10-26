import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';
let db, chair, curator, exec, receivingExec, unrelatedExec, associate, media, coaching, campaigns, cycle;
let counter = 0;
const as = (actor, sql, params = []) => db.as(actor, ({ one }) => one(sql, params));
const context = (actor, id) => as(actor, `select application_decision_context($1) as data`, [id]).then((r) => r.data);
const accept = (actor, app, team) => as(actor, `select accept_application($1,$2) as data`, [app, team]).then((r) => r.data);
const refer = (actor, app, team) => as(actor, `select refer_application($1,$2,'Strong candidate for this team')`, [app, team]);
async function application({ completed = false, future = false } = {}) {
  counter++;
  const result = await as('service', `select submit_application($1,'Applicant',$2,$3,$4) as data`, [cycle.id, `candidate${counter}@example.invalid`, `010${String(counter).padStart(8, '0')}`, [media]]);
  const a = result.data;
  if (completed || future) {
    await db.q(`insert into interview_slots(cycle_id,team_id,application_id,starts_at,ends_at,interviewer_ids)
      values ($1,$2,$3,now()+$4::interval,now()+$4::interval+interval '20 minutes',$5)`, [cycle.id, media, a.application_id, `${future ? counter : -counter} days`, [exec]]);
    await db.q(`update applications set stage='interview' where id=$1`, [a.application_id]);
  }
  return a;
}
before(async () => {
  db = await createDb(); chair = await db.member('chairman'); curator = await db.member('curator', 'marketing');
  exec = await db.member('executive', 'media_design'); receivingExec = await db.member('executive', 'coaching');
  unrelatedExec = await db.member('executive', 'campaigns_copyrights'); associate = await db.member('associate', 'media_design');
  media = await db.team('media_design'); coaching = await db.team('coaching'); campaigns = await db.team('campaigns_copyrights');
  cycle = await as(chair, `insert into recruitment_cycles(name,opens_at,closes_at) values ('Executive decisions',now()-interval '1 day',now()+interval '10 days') returning id`);
  for (const team of [media, coaching, campaigns]) await db.q(`insert into positions(cycle_id,team_id) values ($1,$2)`, [cycle.id, team]);
});

test('Executives cannot accept or refer applicants until their interview has finished', async () => {
  for (const a of [await application(), await application({ future: true })]) {
    assert.deepEqual((await context(exec, a.application_id)).acceptable_team_ids, []);
    await rejects(accept(exec, a.application_id, media), /not_allowed/);
    await rejects(refer(exec, a.application_id, coaching), /interview_not_completed/);
  }
});

test('Executive accepts into own team and can read the exact invite needed by staff-actions', async () => {
  const a = await application({ completed: true });
  assert.deepEqual((await context(exec, a.application_id)).acceptable_team_ids, [media]);
  await rejects(accept(exec, a.application_id, coaching), /not_allowed/);
  const result = await accept(exec, a.application_id, media);
  const invite = await as(exec, `select id,email,accepted_at,revoked_at,expires_at from invites where id=$1`, [result.invite_id]);
  assert.equal(invite.email, a.applicant_email);
  assert.equal(await as(unrelatedExec, `select id from invites where id=$1`, [result.invite_id]), undefined);
  await rejects(db.as(exec, ({ q }) => q(`insert into invites(email,season_id,role,team_id) select 'forged@example.invalid',season_id,'curator',$1 from recruitment_cycles where id=$2`, [media, cycle.id])), /row-level security|check constraint/);
  const user = await db.one(`insert into auth.users(email,raw_user_meta_data) values ($1,'{"full_name":"Accepted candidate"}') returning id`, [a.applicant_email]);
  assert.deepEqual(await db.one(`select role,team_id from memberships where user_id=$1`, [user.id]), { role: 'associate', team_id: media });
});

test('reallocation preserves preferences, grants the receiving team review, and requires receiving-team acceptance', async () => {
  const a = await application({ completed: true });
  assert.equal(await as(receivingExec, `select id from applications where id=$1`, [a.application_id]), undefined);
  await rejects(accept(receivingExec, a.application_id, coaching), /not_allowed/);
  await refer(exec, a.application_id, coaching);
  await refer(exec, a.application_id, campaigns);
  await rejects(refer(exec, a.application_id, coaching), /already_referred/);
  const received = await as(receivingExec, `select team_choices from applications where id=$1`, [a.application_id]);
  assert.deepEqual(received.team_choices, [media]);
  const ctx = await context(receivingExec, a.application_id);
  assert.deepEqual(ctx.acceptable_team_ids, [coaching]);
  assert.equal(ctx.referrals[0].notes, 'Strong candidate for this team');
  await rejects(accept(exec, a.application_id, coaching), /not_allowed/);
  await rejects(accept(receivingExec, a.application_id, campaigns), /not_allowed/);
  const accepted = await accept(receivingExec, a.application_id, coaching);
  assert.equal((await as(receivingExec, `select id from invites where id=$1`, [accepted.invite_id])).id, accepted.invite_id);
  const saved = await db.one(`select stage,accepted_team_id,team_choices from applications where id=$1`, [a.application_id]);
  assert.deepEqual(saved, { stage: 'accepted', accepted_team_id: coaching, team_choices: [media] });
  assert.deepEqual((await db.q(`select status from application_referrals where application_id=$1 order by to_team_id`, [a.application_id])).map((r) => r.status).sort(), ['accepted', 'closed']);
  await rejects(accept(unrelatedExec, a.application_id, campaigns), /application_closed/);
});

test('Associates, unrelated managers, anonymous callers and direct referral writes cannot bypass authorization', async () => {
  const a = await application({ completed: true });
  for (const actor of [associate, unrelatedExec]) {
    await rejects(context(actor, a.application_id), /not_allowed/);
    await rejects(refer(actor, a.application_id, coaching), /not_allowed/);
    await rejects(accept(actor, a.application_id, media), /not_allowed/);
  }
  await rejects(context('anon', a.application_id), /permission denied/);
  await rejects(db.as(exec, ({ q }) => q(`insert into application_referrals(application_id,from_team_id,to_team_id) values ($1,$2,$3)`, [a.application_id, media, coaching])), /permission denied/);
  await rejects(db.as(exec, ({ q }) => q(`update application_referrals set status='accepted' where application_id=$1`, [a.application_id])), /permission denied/);
  await rejects(db.as(exec, ({ q }) => q(`update applications set accepted_team_id=$1 where id=$2`, [media, a.application_id])), /permission denied/);
});

test('a conflicting invitation cannot be reused to give the accepted applicant a different role', async () => {
  const a = await application({ completed: true });
  await db.q(`insert into invites(email,season_id,role,team_id) select $1,season_id,'executive',$2 from recruitment_cycles where id=$3`, [a.applicant_email, media, cycle.id]);
  await rejects(accept(exec, a.application_id, media), /existing_invite_conflict/);
  assert.equal((await db.one(`select stage from applications where id=$1`, [a.application_id])).stage, 'interview');
});

test('Chairman and scoped Curator oversight remains available', async () => {
  const a = await application();
  await accept(curator, a.application_id, media);
  const b = await application();
  await accept(chair, b.application_id, media);
});

test('accepting a recruitment application cannot replace an existing Chairman membership', async () => {
  const a = await application({ completed: true });
  const member = await db.one(`select email from users where id=$1`, [chair]);
  await db.q(`update applications set applicant_email=$1 where id=$2`, [member.email, a.application_id]);
  await rejects(accept(exec, a.application_id, media), /duplicate key|membership/);
  assert.equal((await db.one(`select role from memberships where user_id=$1 and status='active'`, [chair])).role, 'chairman');
});
