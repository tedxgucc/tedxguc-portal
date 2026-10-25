// Tasks: visibility, assignment, status rules, cross-team requests, reminders.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mktCurator, talksCurator, mediaExec, mediaAssoc, mediaAssoc2, coachingAssoc, lpExec;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mktCurator = await db.member('curator', 'marketing');
  talksCurator = await db.member('curator', 'talks');
  mediaExec = await db.member('executive', 'media_design');
  mediaAssoc = await db.member('associate', 'media_design');
  mediaAssoc2 = await db.member('associate', 'media_design');
  coachingAssoc = await db.member('associate', 'coaching');
  lpExec = await db.member('executive', 'logistics_planning');
});

async function newTask(title = 'Poster', assignees = [mediaAssoc], deadline = null) {
  const team = await db.team('media_design');
  return db.as(mediaExec, async ({ one, q }) => {
    const t = await one(`insert into tasks (team_id, title, deadline) values ($1, $2, $3) returning *`, [team, title, deadline]);
    for (const a of assignees) await q(`insert into task_assignees (task_id, user_id) values ($1, $2)`, [t.id, a]);
    return t;
  });
}

const visible = (who, id) => db.as(who, ({ q }) => q(`select id from tasks where id = $1`, [id])).then((r) => r.length === 1);

test('Associates see only their own tasks; managers see the team (FR-6, matrix)', async () => {
  const t = await newTask('Own task');
  assert.equal(await visible(mediaAssoc, t.id), true);
  assert.equal(await visible(mediaAssoc2, t.id), false, 'teammate not assigned');
  assert.equal(await visible(coachingAssoc, t.id), false, 'other team');
  assert.equal(await visible(mediaExec, t.id), true);
  assert.equal(await visible(mktCurator, t.id), true, 'division curator');
  assert.equal(await visible(talksCurator, t.id), false, 'other division curator');
  assert.equal(await visible(chairman, t.id), true);
});

test('Associates cannot create tasks; Executives only for their own team', async () => {
  const media = await db.team('media_design');
  const coaching = await db.team('coaching');
  await rejects(db.as(mediaAssoc, ({ q }) => q(`insert into tasks (team_id, title) values ($1, 'x')`, [media])), /row-level security/);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into tasks (team_id, title) values ($1, 'x')`, [coaching])), /row-level security/);
});

test('assignees must be in the team', async () => {
  const t = await newTask('Team only', []);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into task_assignees (task_id, user_id) values ($1, $2)`, [t.id, coachingAssoc])), /assignee_not_in_team/);
});

test('several assignees, each notified (FR-6.1)', async () => {
  const t = await newTask('Pair task', [mediaAssoc, mediaAssoc2]);
  assert.equal(await visible(mediaAssoc2, t.id), true);
  const n = await db.as(mediaAssoc2, ({ q }) => q(`select title from notifications where type = 'task_assigned' and link like '%' || $1`, [t.id]));
  assert.equal(n.length, 1);
});

test('assignees move status but cannot mark Done or edit details (FR-6.2)', async () => {
  const t = await newTask('Status flow');
  const setStatus = (who, s) => db.as(who, ({ q }) => q(`update tasks set status = $2 where id = $1 returning status`, [t.id, s]));
  assert.equal((await setStatus(mediaAssoc, 'in_progress'))[0].status, 'in_progress');
  assert.equal((await setStatus(mediaAssoc, 'in_review'))[0].status, 'in_review');
  await rejects(setStatus(mediaAssoc, 'done'), /only_creator_or_executive_marks_done/);
  await rejects(db.as(mediaAssoc, ({ q }) => q(`update tasks set title = 'hacked' where id = $1`, [t.id])), /only_managers_edit_task_details/);
  await rejects(db.as(mediaAssoc, ({ q }) => q(`update tasks set created_by = auth.uid() where id = $1`, [t.id])), /permission denied/);

  const execNotif = await db.as(mediaExec, ({ q }) => q(`select 1 from notifications where type = 'task_in_review'`));
  assert.ok(execNotif.length >= 1, 'executive told it is ready for review');

  const done = await setStatus(mediaExec, 'done');
  assert.equal(done[0].status, 'done');
  const row = await db.one(`select completed_at from tasks where id = $1`, [t.id]);
  assert.ok(row.completed_at);
  // Not visible to people outside, and nobody else can update it.
  assert.equal((await setStatus(coachingAssoc, 'todo')).length, 0);
});

test('cross-team request: the Marketing Curator asks L&P; L&P accepts or declines (FR-6.5)', async () => {
  const lp = await db.team('logistics_planning');
  const media = await db.team('media_design');
  // Executives work inside their own team only (migration 0012).
  await rejects(db.as(mediaExec, ({ q }) => q(
    `insert into tasks (team_id, requested_by_team_id, title) values ($1, $2, 'x')`, [lp, media])), /row-level security/);
  const req = await db.as(mktCurator, ({ one }) => one(
    `insert into tasks (team_id, requested_by_team_id, title, status) values ($1, $2, 'Print 200 flyers', 'todo') returning *`, [lp, media]));
  assert.equal(req.status, 'requested', 'requests always start as requested');
  assert.equal((await db.as(lpExec, ({ q }) => q(`select 1 from notifications where type = 'task_request'`))).length, 1);

  // The requester can see it but can't accept their own request.
  assert.equal(await visible(mktCurator, req.id), true);
  await rejects(db.as(mktCurator, ({ q }) => q(`update tasks set status = 'todo' where id = $1`, [req.id])), /only_receiving_team_accepts_requests/);
  // Associates in the requesting team don't see it.
  assert.equal(await visible(mediaAssoc, req.id), false);

  await db.as(lpExec, ({ q }) => q(`update tasks set status = 'declined', decline_reason = 'No budget' where id = $1`, [req.id]));
  const n = await db.as(mktCurator, ({ one }) => one(`select title, body from notifications where type = 'task_request_declined'`));
  assert.match(n.title, /declined/);
  assert.equal(n.body, 'No budget');

  // Associates can't send requests.
  await rejects(db.as(mediaAssoc, ({ q }) => q(
    `insert into tasks (team_id, requested_by_team_id, title) values ($1, $2, 'x')`, [lp, media])), /row-level security/);
});

test('comments: visible to people on the task; @mentions only reach people who can see it (FR-6.3)', async () => {
  const t = await newTask('Discuss');
  await db.as(mediaAssoc, ({ q }) => q(
    `insert into task_comments (task_id, body, mentions) values ($1, 'Check this @exec @outsider', $2)`,
    [t.id, `{${mediaExec},${coachingAssoc}}`]));
  const c = await db.one(`select mentions from task_comments where task_id = $1`, [t.id]);
  assert.deepEqual(c.mentions, [mediaExec]);
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select 1 from notifications where type = 'task_mention'`))).length, 1);
  assert.equal((await db.as(coachingAssoc, ({ q }) => q(`select 1 from notifications where type = 'task_mention'`))).length, 0);
  await rejects(db.as(coachingAssoc, ({ q }) => q(`insert into task_comments (task_id, body) values ($1, 'hi')`, [t.id])), /row-level security/);
  assert.equal((await db.as(mediaAssoc2, ({ q }) => q(`select 1 from task_comments where task_id = $1`, [t.id]))).length, 0);
});

test('task files: only people who can see the task can read or upload them', async () => {
  const t = await newTask('Files');
  await db.as(mediaAssoc, ({ q }) => q(`insert into storage.objects (bucket_id, name) values ('task-files', $1)`, [`${t.id}/draft.pdf`]));
  await rejects(db.as(coachingAssoc, ({ q }) => q(`insert into storage.objects (bucket_id, name) values ('task-files', $1)`, [`${t.id}/x.pdf`])), /row-level security/);
  assert.equal((await db.as(mediaAssoc2, ({ q }) => q(`select 1 from storage.objects where bucket_id = 'task-files'`))).length, 0);
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select 1 from storage.objects where bucket_id = 'task-files'`))).length, 1);
});

test('reminders 24 h before and overdue flags to Executive and Curator (FR-6.4)', async () => {
  const soon = await newTask('Due soon', [mediaAssoc2], new Date(Date.now() + 3 * 3600_000).toISOString());
  const late = await newTask('Late', [mediaAssoc2], new Date(Date.now() - 3600_000).toISOString());
  await db.q(`select private.run_task_reminders()`);
  await db.q(`select private.run_task_reminders()`); // second run sends nothing new

  const mine = await db.as(mediaAssoc2, ({ q }) => q(`select type, link from notifications where type in ('task_due_soon', 'task_overdue')`));
  assert.deepEqual(mine.map((n) => n.type).sort(), ['task_due_soon', 'task_overdue']);
  const curator = await db.as(mktCurator, ({ q }) => q(`select link from notifications where type = 'task_overdue'`));
  assert.equal(curator.length, 1);
  assert.ok(curator[0].link.endsWith(late.id));
  assert.equal((await db.as(talksCurator, ({ q }) => q(`select 1 from notifications where type = 'task_overdue'`))).length, 0);
  assert.ok(soon.id);
});
