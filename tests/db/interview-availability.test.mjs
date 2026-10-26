import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';
let db, chair, curator, executive, associate, outsider, cycle, media, campaigns, coaching;
const template = { weekly: [[], [], [], [], [], [], []], location: 'C3.201' };
const slot = (hour, minutes = 0) => {
  const start = Date.now() + 5 * 86400_000 + hour * 3600_000 + minutes * 60_000;
  return { starts_at: new Date(start).toISOString(), ends_at: new Date(start + 20 * 60_000).toISOString() };
};
const publish = (who, team, slots = [], schedule = template) => db.as(who, ({ one }) => one(`select save_interview_availability($1,$2,$3,$4) as result`, [cycle.id, team, schedule, slots])).then((r) => r.result);
before(async () => {
  db = await createDb();
  chair = await db.member('chairman'); curator = await db.member('curator', 'marketing');
  executive = await db.member('executive', 'media_design'); associate = await db.member('associate', 'media_design');
  outsider = await db.member('executive', 'coaching');
  media = await db.team('media_design'); campaigns = await db.team('campaigns_copyrights'); coaching = await db.team('coaching');
  cycle = await db.as(chair, ({ one }) => one(`insert into recruitment_cycles(name,opens_at,closes_at) values ('Availability round',now(),now()+interval '10 days') returning id`));
});

test('board scheduling permissions and template privacy follow team scope', async () => {
  await publish(chair, coaching); await publish(curator, media); await publish(curator, campaigns); await publish(executive, media);
  await rejects(publish(curator, coaching), /not_allowed/);
  await rejects(publish(executive, campaigns), /not_allowed/);
  await rejects(publish(associate, media), /not_allowed/);
  await rejects(publish('anon', media), /permission denied/);
  assert.equal((await db.as(executive, ({ q }) => q(`select * from interview_availability`))).length, 1);
  assert.equal((await db.as(associate, ({ q }) => q(`select * from interview_availability`))).length, 0);
  await rejects(db.as(executive, ({ q }) => q(`delete from interview_availability`)), /permission denied/);
});

test('publication is atomic and repeat publication keeps existing slots', async () => {
  const times = [slot(1), slot(2)];
  assert.deepEqual(await publish(executive, media, times), { added: 2, skipped: 0 });
  const applicant = await db.one(`insert into applications(cycle_id,applicant_name,applicant_email,team_choices,status_token_hash,consent_at)
    values ($1,'Booked applicant','booked@example.invalid',$2,'availability-test-token',now()) returning id`, [cycle.id, [media]]);
  await db.q(`update interview_slots set application_id=$1, booked_at=now() where team_id=$2 and starts_at=$3`, [applicant.id, media, times[0].starts_at]);
  assert.deepEqual(await publish(executive, media, times), { added: 0, skipped: 2 });
  assert.equal((await db.one(`select application_id from interview_slots where team_id=$1 and starts_at=$2`, [media, times[0].starts_at])).application_id, applicant.id);
  const saved = await db.as(executive, ({ one }) => one(`select schedule from interview_availability where team_id=$1`, [media]));
  assert.deepEqual(saved.schedule, template);
  const count = (await db.one(`select count(*)::int n from interview_slots`)).n;
  await rejects(publish(executive, media, [slot(3), { starts_at: times[0].starts_at, ends_at: new Date(Date.parse(times[0].ends_at) + 60_000).toISOString() }], { ...template, location: 'Must roll back' }), /interview_time_conflict/);
  assert.equal((await db.one(`select count(*)::int n from interview_slots`)).n, count);
  assert.equal((await db.as(executive, ({ one }) => one(`select schedule from interview_availability where team_id=$1`, [media]))).schedule.location, 'C3.201');
});

test('overlap is rejected across teams and the original slot API; adjacent times and different interviewers work', async () => {
  const t = slot(10);
  await publish(curator, media, [t]);
  await rejects(publish(curator, campaigns, [{ ...t, ends_at: new Date(Date.parse(t.ends_at) + 60_000).toISOString() }]), /interview_time_conflict/);
  await rejects(db.as(curator, ({ q }) => q(`insert into interview_slots(cycle_id,team_id,starts_at,ends_at,interviewer_ids) values ($1,$2,$3,$4,$5)`, [cycle.id, campaigns, t.starts_at, t.ends_at, [curator]])), /interview_time_conflict/);
  await publish(outsider, coaching, [t]);
  await publish(curator, campaigns, [{ starts_at: t.ends_at, ends_at: new Date(Date.parse(t.ends_at) + 20 * 60_000).toISOString() }]);
});

test('malformed and past slots cannot leave partially published availability', async () => {
  await rejects(publish(executive, media, [{ starts_at: '2020-01-01', ends_at: '2020-01-02' }]), /invalid_interview_time/);
  await rejects(publish(executive, media, [], { weekly: [] }), /invalid_availability/);
  await rejects(publish(executive, media, [slot(20), { starts_at: null, ends_at: null }]), /invalid_interview_time/);
});
