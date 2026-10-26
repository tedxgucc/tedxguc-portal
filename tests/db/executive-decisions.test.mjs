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

test('Executives can accept and refer before booking or before the scheduled interview finishes', async () => {
  for (const a of [await application(), await application({ future: true })]) {
    assert.equal((await context(exec, a.application_id)).interview_completed, false);
    assert.deepEqual((await context(exec, a.application_id)).acceptable_team_ids, [media]);
    await refer(exec, a.application_id, coaching);
    await accept(exec, a.application_id, media);
    await rejects(refer(exec, a.application_id, campaigns), /application_closed/);
  }
});

test('screened and rejected applicants can be reconsidered; withdrawn applications stay closed', async () => {
  for (const stage of ['screened', 'rejected']) {
    const a = await application();
    await db.q(`update applications set stage=$1 where id=$2`, [stage, a.application_id]);
    await refer(exec, a.application_id, coaching);
    await accept(receivingExec, a.application_id, coaching);
  }
  const withdrawn = await application();
  await db.q(`update applications set stage='withdrawn' where id=$1`, [withdrawn.application_id]);
  await rejects(accept(exec, withdrawn.application_id, media), /application_closed/);
  await rejects(refer(exec, withdrawn.application_id, coaching), /application_closed/);
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
  const retry = await accept(exec, a.application_id, media);
  assert.equal(retry.invite_id, result.invite_id);
  await rejects(accept(exec, a.application_id, coaching), /not_allowed/);
  await rejects(accept(unrelatedExec, a.application_id, media), /not_allowed/);
  assert.equal((await db.one(`select count(*)::int as n from memberships where user_id=$1`, [user.id])).n, 1);
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
  await rejects(accept(unrelatedExec, a.application_id, campaigns), /not_allowed/);
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

test('Executives can reject their applicants but cannot change other stages or reject unrelated applicants', async () => {
  const a = await application();
  const rejected = await as(exec, `select set_application_stage($1,'rejected') as data`, [[a.application_id]]);
  assert.deepEqual(rejected.data, [], 'rejection email remains held until round release');
  assert.equal((await db.one(`select stage from applications where id=$1`, [a.application_id])).stage, 'rejected');
  assert.equal((await as('anon', `select get_application_by_token($1) as data`, [a.status_token])).data.stage, 'in_review');
  const b = await application();
  await rejects(as(exec, `select set_application_stage($1,'screened')`, [[b.application_id]]), /not_allowed/);
  await rejects(as(exec, `select set_application_stage($1,'interview')`, [[b.application_id]]), /not_allowed/);
  await rejects(as(unrelatedExec, `select set_application_stage($1,'rejected')`, [[b.application_id]]), /not_allowed/);
  await rejects(as(associate, `select set_application_stage($1,'rejected')`, [[b.application_id]]), /not_allowed/);
});

test('reallocation supports a destination with no recruitment position and its Executive can accept or reject', async () => {
  const lp = await db.team('logistics_planning');
  const lpExec = await db.member('executive', 'logistics_planning');
  assert.equal((await db.one(`select count(*)::int n from positions where cycle_id=$1 and team_id=$2`, [cycle.id, lp])).n, 0);
  const a = await application();
  await refer(exec, a.application_id, lp);
  assert.deepEqual((await context(lpExec, a.application_id)).acceptable_team_ids, [lp]);
  await accept(lpExec, a.application_id, lp);
  const b = await application();
  await refer(exec, b.application_id, lp);
  await as(lpExec, `select set_application_stage($1,'rejected')`, [[b.application_id]]);
  assert.equal((await db.one(`select stage from applications where id=$1`, [b.application_id])).stage, 'rejected');
});

test('mixed-scope bulk rejection rolls back every change', async () => {
  const own = await application(); const outside = await application();
  await db.q(`update applications set team_choices=$1 where id=$2`, [[coaching], outside.application_id]);
  await rejects(as(exec, `select set_application_stage($1,'rejected')`, [[own.application_id, outside.application_id]]), /not_allowed/);
  assert.equal((await db.one(`select stage from applications where id=$1`, [own.application_id])).stage, 'applied');
});
