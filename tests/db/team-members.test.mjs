import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chair, curator, otherCurator, exec, otherExec, assoc, outsider, media, campaigns, coaching;
before(async () => {
  db = await createDb();
  chair = await db.member('chairman');
  curator = await db.member('curator', 'marketing');
  otherCurator = await db.member('curator', 'talks');
  exec = await db.member('executive', 'media_design');
  otherExec = await db.member('executive', 'campaigns_copyrights');
  assoc = await db.member('associate', 'media_design');
  outsider = await db.member('associate', 'coaching');
  media = await db.team('media_design');
  campaigns = await db.team('campaigns_copyrights');
  coaching = await db.team('coaching');
});
const change = (who, action, team, user) => db.as(who, ({ q }) => q(`select ${action}_team_member($1, $2)`, [team, user]));
const links = (user) => db.q(`select team_id from team_roster where user_id = $1 and status = 'active' order by team_id`, [user]).then((r) => r.map((x) => x.team_id));

test('invited users receive their primary team assignment automatically', async () => {
  assert.deepEqual(await links(assoc), [media]);
  assert.deepEqual(await links(exec), [media]);
});

test('Chairman can add and remove every role without changing club roles', async () => {
  for (const [user, role] of [[chair, 'chairman'], [curator, 'curator'], [exec, 'executive'], [outsider, 'associate']]) {
    const before = await links(user);
    await change(chair, 'add', campaigns, user);
    await rejects(change(chair, 'add', campaigns, user), /already_in_team/);
    assert.equal((await db.one(`select role from memberships where user_id = $1`, [user])).role, role);
    await change(chair, 'remove', campaigns, user);
    assert.deepEqual(await links(user), before);
  }
});

test('Curator manages lower roles in division but cannot manage board roles or outside division', async () => {
  for (const user of [exec, assoc]) {
    await change(curator, 'add', campaigns, user);
    await change(curator, 'remove', campaigns, user);
  }
  for (const user of [chair, curator, otherCurator, outsider]) {
    await rejects(change(curator, 'add', media, user), /not_allowed/);
    await rejects(change(curator, 'remove', media, user), /not_allowed/);
  }
  await rejects(change(curator, 'add', coaching, assoc), /not_allowed/);
  await rejects(change(curator, 'remove', coaching, outsider), /not_allowed/);
});

test('Executive restores an unassigned own-division Associate, and cannot pull other teams or higher roles', async () => {
  await change(exec, 'remove', media, assoc);
  const row = await db.one(`select role, status, team_id, division_id from memberships where user_id = $1`, [assoc]);
  assert.equal(row.role, 'associate');
  assert.equal(row.status, 'active');
  assert.equal(row.team_id, null);
  assert.ok(row.division_id);
  await change(exec, 'add', media, assoc);
  assert.deepEqual(await links(assoc), [media]);
  await rejects(change(otherExec, 'add', campaigns, assoc), /not_allowed/);
  await rejects(change(exec, 'add', campaigns, assoc), /not_allowed/);
  await rejects(change(exec, 'remove', campaigns, assoc), /not_allowed/);
  for (const user of [chair, curator, exec, otherExec, outsider]) {
    await rejects(change(exec, 'add', media, user), /not_allowed/);
    await rejects(change(exec, 'remove', media, user), /not_allowed/);
  }
});

test('Associate, anonymous callers and direct table writes cannot bypass management rules', async () => {
  for (const action of ['add', 'remove']) {
    await rejects(change(assoc, action, media, outsider), /not_allowed/);
    await rejects(change('anon', action, media, assoc), /permission denied/);
  }
  for (const actor of [chair, curator, exec, assoc]) {
    await rejects(db.as(actor, ({ q }) => q(`delete from team_memberships where team_id = $1`, [media])), /permission denied/);
    await rejects(db.as(actor, ({ q }) => q(`insert into team_memberships(membership_id, team_id) select id, $1 from memberships where user_id = $2`, [campaigns, assoc])), /permission denied/);
    await rejects(db.as(actor, ({ q }) => q(`update team_roster set team_id = $1 where user_id = $2`, [campaigns, assoc])), /permission denied|cannot update view/);
  }
});

test('removing primary team preserves the account, active membership, other assignments and their access', async () => {
  await change(chair, 'add', campaigns, assoc);
  await change(exec, 'remove', media, assoc);
  assert.deepEqual(await links(assoc), [campaigns]);
  const row = await db.one(`select m.status, m.role, m.team_id, u.id from memberships m join users u on u.id = m.user_id where m.user_id = $1`, [assoc]);
  assert.deepEqual(row, { status: 'active', role: 'associate', team_id: null, id: assoc });
  await rejects(change(exec, 'add', media, assoc), /not_allowed/);
  await db.as(assoc, async ({ one }) => {
    assert.equal((await one(`select private.can_see_team($1) as ok`, [campaigns])).ok, true);
    assert.equal((await one(`select private.can_see_team($1) as ok`, [media])).ok, false);
  });
  await change(curator, 'add', media, assoc);
});

test('secondary Executive assignment never grants authority over another team', async () => {
  await change(chair, 'add', campaigns, exec);
  assert.equal((await db.as(exec, ({ one }) => one(`select private.can_manage_team($1) as ok`, [campaigns]))).ok, false);
  await rejects(change(exec, 'remove', campaigns, assoc), /not_allowed/);
  await change(chair, 'remove', media, exec);
  assert.deepEqual(await links(exec), [campaigns]);
  assert.equal((await db.as(exec, ({ one }) => one(`select private.can_manage_team($1) as ok`, [campaigns]))).ok, false);
  await change(chair, 'add', media, exec);
});

test('shared team members appear in roll call while other-team attendance stays private', async () => {
  const create = (who, team) => db.as(who, ({ one }) => one(`insert into meetings(type, title, team_id, starts_at) values ('team_meeting', 'Shared roster', $1, now()) returning id`, [team]));
  const first = await create(exec, media);
  const second = await create(otherExec, campaigns);
  const roster = await db.as(otherExec, ({ q }) => q(`select user_id from meeting_roll_call($1)`, [second.id]));
  assert.ok(roster.some((r) => r.user_id === assoc));
  const marks = JSON.stringify([{ user_id: assoc, status: 'attended' }]);
  await db.as(otherExec, ({ q }) => q(`select submit_attendance($1, $2)`, [second.id, marks]));
  await rejects(db.as(exec, ({ q }) => q(`select submit_attendance($1, $2)`, [second.id, marks])), /not_allowed/);
  assert.equal((await db.as(exec, ({ q }) => q(`select * from attendance where meeting_id = $1`, [second.id]))).length, 0);
  assert.equal((await db.as(otherExec, ({ q }) => q(`select * from meeting_roll_call($1)`, [first.id]))).length, 0);
});

test('secondary assignments support tasks and team announcements without changing leadership', async () => {
  const task = await db.as(otherExec, async ({ one, q }) => {
    const task = await one(`insert into tasks(team_id, title) values ($1, 'Shared member task') returning id`, [campaigns]);
    await q(`insert into task_assignees(task_id, user_id) values ($1, $2)`, [task.id, assoc]);
    return task;
  });
  assert.equal((await db.as(assoc, ({ q }) => q(`select id from tasks where id = $1`, [task.id]))).length, 1);
  assert.equal((await db.as(assoc, ({ one }) => one(`select private.in_audience('team', null, $1, null) as ok`, [campaigns]))).ok, true);
  assert.equal((await db.as(outsider, ({ one }) => one(`select private.in_audience('team', null, $1, null) as ok`, [campaigns]))).ok, false);
  await change(chair, 'remove', campaigns, assoc);
  const next = await db.as(otherExec, ({ one }) => one(`insert into tasks(team_id, title) values ($1, 'No longer on team') returning id`, [campaigns]));
  await rejects(db.as(otherExec, ({ q }) => q(`insert into task_assignees(task_id, user_id) values ($1, $2)`, [next.id, assoc])), /assignee_not_in_team/);
});

test('inactive members, missing users and teams in another season are rejected', async () => {
  const inactive = await db.member('associate', 'media_design');
  await db.q(`update memberships set status = 'removed' where user_id = $1`, [inactive]);
  await rejects(change(chair, 'add', media, inactive), /not_allowed/);
  await rejects(change(inactive, 'remove', media, assoc), /not_allowed/);
  await rejects(change(chair, 'add', media, '00000000-0000-4000-8000-000000000000'), /not_allowed/);
  const season = await db.one(`insert into seasons(year, theme) values (2030, 'Other season') returning id`);
  const division = await db.one(`insert into divisions(season_id, kind, name) values ($1, 'marketing', 'Other division') returning id`, [season.id]);
  const team = await db.one(`insert into teams(season_id, division_id, kind, name) values ($1, $2, 'media_design', 'Other team') returning id`, [season.id, division.id]);
  await rejects(change(chair, 'add', team.id, assoc), /not_allowed/);
});
