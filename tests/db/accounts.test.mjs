// Accounts, roles, invites, seasons, directory privacy, audit log.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, opsCurator, talksCurator, coachingExec, coachingAssoc, lpAssoc;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  opsCurator = await db.member('curator', 'operations');
  talksCurator = await db.member('curator', 'talks');
  coachingExec = await db.member('executive', 'coaching');
  coachingAssoc = await db.member('associate', 'coaching');
  lpAssoc = await db.member('associate', 'logistics_planning');
});

const hook = (email, provider = 'google') =>
  db.one(`select public.hook_before_user_created($1) as r`,
    [{ user: { email, app_metadata: { provider } } }]).then((x) => x.r);

test('sign-up hook: Google accounts outside GUC are blocked', async () => {
  const r = await hook('someone@gmail.com');
  assert.equal(r.error.http_code, 403);
  assert.match(r.error.message, /GUC email/);
});

test('sign-up hook: GUC email without an invite is blocked', async () => {
  const r = await hook('stranger@student.guc.edu.eg');
  assert.match(r.error.message, /invite-only/);
});

test('sign-up hook: invited GUC email is allowed; email+password invite can be any domain', async () => {
  const season = (await db.one(`select id from seasons where is_active`)).id;
  const team = await db.team('media_design');
  await db.q(`insert into invites (email, season_id, role, team_id) values ('new.one@student.guc.edu.eg', $1, 'associate', $2)`, [season, team]);
  await db.q(`insert into invites (email, season_id, role, team_id) values ('personal@gmail.com', $1, 'associate', $2)`, [season, team]);
  assert.deepEqual(await hook('New.One@student.guc.edu.eg'), {});
  assert.deepEqual(await hook('personal@gmail.com', 'email'), {});
  assert.ok((await hook('personal@gmail.com', 'google')).error, 'google still needs a GUC domain');
});

test('sign-up hook cannot be called through the API', async () => {
  await rejects(db.as('anon', ({ q }) => q(`select public.hook_before_user_created('{}')`)), /permission denied/);
  await rejects(db.as(coachingAssoc, ({ q }) => q(`select public.hook_before_user_created('{}')`)), /permission denied/);
});

test('first login turns the invite into a membership with the right division', async () => {
  const m = await db.one(
    `select m.role, d.kind from memberships m join divisions d on d.id = m.division_id where m.user_id = $1`,
    [lpAssoc]);
  assert.deepEqual(m, { role: 'associate', kind: 'operations' });
  const inv = await db.one(`select accepted_at from invites where accepted_by = $1`, [lpAssoc]);
  assert.ok(inv.accepted_at);
});

test('Associates see the directory but not phone numbers; Executives see them', async () => {
  await db.as(coachingExec, ({ q }) => q(`update user_private set phone = '0100' where user_id = auth.uid()`));
  const assocView = await db.as(coachingAssoc, ({ q }) => q(`select user_id, phone from user_private`));
  assert.deepEqual(assocView.map((r) => r.user_id), [coachingAssoc]);
  const dir = await db.as(coachingAssoc, ({ one }) => one(`select count(*)::int as n from users`));
  assert.ok(dir.n >= 6);
  const execView = await db.as(coachingExec, ({ q }) => q(`select phone from user_private where phone is not null`));
  assert.equal(execView.length, 1);
});

test('guests cannot read members at all', async () => {
  await rejects(db.as('anon', ({ q }) => q(`select * from users`)), /permission denied/);
  await rejects(db.as('anon', ({ q }) => q(`select * from memberships`)), /permission denied/);
  await rejects(db.as('anon', ({ q }) => q(`select * from user_private`)), /permission denied/);
});

test('members edit their own profile only, and cannot change their email', async () => {
  await db.as(coachingAssoc, ({ q }) => q(`update users set major = 'CS' where id = auth.uid()`));
  const other = await db.as(coachingAssoc, ({ q }) => q(`update users set major = 'X' where id = $1 returning id`, [coachingExec]));
  assert.equal(other.length, 0);
  await rejects(db.as(coachingAssoc, ({ q }) => q(`update users set email = 'x@y.z' where id = auth.uid()`)), /permission denied/);
});

test('Curators invite only into their own division and only Executives/Associates', async () => {
  const season = (await db.one(`select id from seasons where is_active`)).id;
  const coaching = await db.team('coaching');
  const partnerships = await db.team('partnerships');
  await db.as(talksCurator, ({ q }) => q(
    `insert into invites (email, season_id, role, team_id) values ('a1@student.guc.edu.eg', $1, 'associate', $2)`, [season, coaching]));
  await rejects(db.as(talksCurator, ({ q }) => q(
    `insert into invites (email, season_id, role, team_id) values ('a2@student.guc.edu.eg', $1, 'associate', $2)`, [season, partnerships])),
    /row-level security/);
  const talks = await db.division('talks');
  await rejects(db.as(talksCurator, ({ q }) => q(
    `insert into invites (email, season_id, role, division_id) values ('a3@student.guc.edu.eg', $1, 'curator', $2)`, [season, talks])),
    /row-level security/);
  await rejects(db.as(coachingExec, ({ q }) => q(
    `insert into invites (email, season_id, role, team_id) values ('a4@student.guc.edu.eg', $1, 'associate', $2)`, [season, coaching])),
    /row-level security/);
});

test('only the Chairman changes roles; the change is in the audit log', async () => {
  const mid = (await db.one(`select id from memberships where user_id = $1`, [coachingAssoc])).id;
  const blocked = await db.as(talksCurator, ({ q }) => q(`update memberships set role = 'executive' where id = $1 returning id`, [mid]));
  assert.equal(blocked.length, 0, 'curator cannot edit memberships directly');

  // The Curator requests, the Chairman approves.
  const req = await db.as(talksCurator, ({ one }) => one(
    `insert into role_change_requests (membership_id, new_role, reason) values ($1, 'executive', 'Great work') returning id`, [mid]));
  await rejects(db.as(talksCurator, ({ q }) => q(`select decide_role_change($1, true)`, [req.id])), /not_allowed/);
  await db.as(chairman, ({ q }) => q(`select decide_role_change($1, true)`, [req.id]));

  const m = await db.one(`select role from memberships where id = $1`, [mid]);
  assert.equal(m.role, 'executive');
  const log = await db.as(chairman, ({ q }) => q(
    `select action, before->>'role' as before, after->>'role' as after from audit_log
     where target_type = 'memberships' and target_id = $1 and action = 'update'`, [mid]));
  assert.deepEqual(log.at(-1), { action: 'update', before: 'associate', after: 'executive' });
  const notif = await db.as(coachingAssoc, ({ q }) => q(`select type from notifications where type = 'role_changed'`));
  assert.equal(notif.length, 1);

  // Put them back for other tests.
  await db.q(`update memberships set role = 'associate' where id = $1`, [mid]);
});

test('Curators cannot request changes for another division', async () => {
  const mid = (await db.one(`select id from memberships where user_id = $1`, [lpAssoc])).id;
  await rejects(db.as(talksCurator, ({ q }) => q(
    `insert into role_change_requests (membership_id, new_role) values ($1, 'executive')`, [mid])), /row-level security/);
});

test('audit log is readable by the Chairman only and cannot be edited', async () => {
  const rows = await db.as(opsCurator, ({ q }) => q(`select * from audit_log`));
  assert.equal(rows.length, 0);
  await rejects(db.as(chairman, ({ q }) => q(`delete from audit_log`)), /permission denied/);
});

test('public board shows names and roles, without emails', async () => {
  const board = await db.as('anon', ({ q }) => q(`select * from get_public_board()`));
  assert.ok(board.length >= 4);
  assert.equal(board[0].role, 'chairman');
  assert.ok(!('email' in board[0]));
});

test('season rollover: old members become alumni; history stays readable', async () => {
  const fresh = await createDb();
  const oldChair = await fresh.member('chairman');
  const assoc = await fresh.member('associate', 'coaching');
  const newSeason = await fresh.as(oldChair, ({ one }) => one(`insert into seasons (year) values (2028) returning id`));
  // A season can't be switched on directly.
  await rejects(fresh.as(oldChair, ({ q }) => q(`update seasons set is_active = true where id = $1`, [newSeason.id])), /permission denied/);
  await rejects(fresh.as(oldChair, ({ q }) => q(`select activate_season($1)`, [newSeason.id])), /new_season_needs_chairman/);

  await fresh.as(oldChair, ({ q }) => q(
    `insert into memberships (user_id, season_id, role) values ($1, $2, 'chairman')`, [assoc, newSeason.id]));
  await rejects(fresh.as(assoc, ({ q }) => q(`select activate_season($1)`, [newSeason.id])), /not_allowed/);
  await fresh.as(oldChair, ({ q }) => q(`select activate_season($1)`, [newSeason.id]));

  const status = await fresh.one(`select status from memberships where user_id = $1 and season_id <> $2`, [oldChair, newSeason.id]);
  assert.equal(status.status, 'alumni');
  assert.equal(await fresh.as(oldChair, ({ one }) => one(`select private.is_member() as m`)).then((r) => r.m), false);
  assert.equal(await fresh.as(assoc, ({ one }) => one(`select private.is_chairman() as c`)).then((r) => r.c), true);
  // Alumni still read the directory and history.
  const seen = await fresh.as(oldChair, ({ q }) => q(`select * from memberships`));
  assert.ok(seen.length >= 3);
});
