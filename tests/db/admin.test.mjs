// Chairman admin: season setup in one step, settings, role changes.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mcCurator, mdExec, mdAssoc;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mcCurator = await db.member('curator', 'marketing');
  mdExec = await db.member('executive', 'media_design');
  mdAssoc = await db.member('associate', 'media_design');
});

test('only the Chairman prepares next season', async () => {
  await rejects(db.as(mcCurator, ({ q }) => q(`select prepare_season(2028, null, $1)`, [mcCurator])), /not_allowed/);
  await rejects(db.as('anon', ({ q }) => q(`select prepare_season(2028, null, $1)`, [mcCurator])), /permission denied/);
});

test('prepare_season copies divisions, teams and settings, and adds the next Chairman', async () => {
  const { id } = await db.as(chairman, ({ one }) => one(`select prepare_season(2028, 'Ripple', $1) as id`, [mdExec]));
  const counts = await db.one(`select
      (select count(*)::int from divisions where season_id = $1) as d_new,
      (select count(*)::int from divisions where season_id = (select id from seasons where is_active)) as d_old,
      (select count(*)::int from teams where season_id = $1) as t_new,
      (select count(*)::int from teams where season_id = (select id from seasons where is_active)) as t_old,
      (select count(*)::int from settings where season_id = $1) as s_new`, [id]);
  assert.equal(counts.d_new, counts.d_old);
  assert.equal(counts.t_new, counts.t_old);
  assert.ok(counts.s_new > 0);
  const m = await db.one(`select role, status from memberships where season_id = $1`, [id]);
  assert.deepEqual(m, { role: 'chairman', status: 'active' });
  // Each new team sits in the new season's division of the same name.
  const bad = await db.one(`select count(*)::int as n from teams t join divisions d on d.id = t.division_id
    where t.season_id = $1 and d.season_id <> $1`, [id]);
  assert.equal(bad.n, 0);
  const log = await db.as(chairman, ({ one }) => one(`select action from audit_log where action = 'season_prepared'`));
  assert.equal(log.action, 'season_prepared');
  await rejects(db.as(chairman, ({ q }) => q(`select prepare_season(2028, null, $1)`, [chairman])), /season_exists/);
});

test('settings: members read, only the Chairman writes, changes are audited', async () => {
  const season = (await db.one(`select id from seasons where is_active`)).id;
  const rows = await db.as(mdAssoc, ({ q }) => q(`select key from settings`));
  assert.ok(rows.length > 0);
  await rejects(db.as(mcCurator, ({ q }) => q(`update settings set value = '9' where key = 'lates_per_absence' and season_id = $1 returning key`, [season])
    .then((r) => { if (!r.length) throw new Error('no rows'); })), /no rows/);
  await db.as(chairman, ({ q }) => q(`update settings set value = '3' where key = 'lates_per_absence' and season_id = $1`, [season]));
  const a = await db.as(chairman, ({ one }) => one(`select after->>'value' as v from audit_log where target_type = 'settings' order by id desc limit 1`));
  assert.equal(a.v, '3');
});

test('role change: Curator requests for own division, Chairman approves', async () => {
  const mem = await db.one(`select id from memberships where user_id = $1 and status = 'active'`, [mdAssoc]);
  const { id } = await db.as(mcCurator, ({ one }) => one(
    `insert into role_change_requests (membership_id, new_role, reason) values ($1, 'executive', 'Stepping up') returning id`, [mem.id]));
  await rejects(db.as(mcCurator, ({ q }) => q(`select decide_role_change($1, true)`, [id])), /not_allowed/);
  await db.as(chairman, ({ q }) => q(`select decide_role_change($1, true)`, [id]));
  const after = await db.one(`select role from memberships where id = $1`, [mem.id]);
  assert.equal(after.role, 'executive');
});
