// Recruitment: applying, reviewing, interviews, accepting, board plans.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mktCurator, talksCurator, mediaExec, campaignsExec, mediaAssoc, cycle, media, campaigns, coaching;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mktCurator = await db.member('curator', 'marketing');
  talksCurator = await db.member('curator', 'talks');
  mediaExec = await db.member('executive', 'media_design');
  campaignsExec = await db.member('executive', 'campaigns_copyrights');
  mediaAssoc = await db.member('associate', 'media_design');
  media = await db.team('media_design');
  campaigns = await db.team('campaigns_copyrights');
  coaching = await db.team('coaching');

  cycle = await db.as(chairman, ({ one }) => one(
    `insert into recruitment_cycles (name, opens_at, closes_at) values ('Fall 2027', now() - interval '1 day', now() + interval '10 days') returning *`));
  await db.as(mktCurator, ({ q }) => q(
    `insert into positions (cycle_id, team_id, questions) values ($1, $2, $3), ($1, $4, '[]')`,
    [cycle.id, media, JSON.stringify([{ id: 'portfolio', label: 'Portfolio link', required: true }]), campaigns]));
});

let phoneCounter = 0;
const apply = (email, choices, answers = { portfolio: 'https://x' }) =>
  db.as('service', ({ one }) => one(
    `select submit_application($1, 'Applicant', $2, $5, $3, $4) as r`,
    [cycle.id, email, `{${choices.join(',')}}`, answers, '+2010' + String(++phoneCounter).padStart(8, '0')])).then((x) => x.r);
const status = (token) => db.as('anon', ({ one }) => one(`select get_application_by_token($1) as r`, [token])).then((x) => x.r);

test('positions: Curators open them for their own division only', async () => {
  await rejects(db.as(mktCurator, ({ q }) => q(`insert into positions (cycle_id, team_id) values ($1, $2)`, [cycle.id, coaching])), /row-level security/);
  const open = await db.as('anon', ({ q }) => q(`select team_id from positions where cycle_id = $1`, [cycle.id]));
  assert.equal(open.length, 2, 'open roles are public (FR-1.6)');
});

test('applying: checks teams, required questions, duplicates; only the server can call it', async () => {
  await rejects(apply('a@x.co', [coaching]), /team_not_recruiting/);
  await rejects(apply('a@x.co', [media], {}), /missing_field:Portfolio link/);
  await rejects(apply('a@x.co', [media, media]), /invalid_team_choices/);
  const a = await apply('A@x.co', [media, campaigns]);
  assert.match(a.status_token, /^[0-9a-f]{64}$/);
  await rejects(apply('a@x.co', [campaigns]), /already_applied/);
  await rejects(db.as('anon', ({ q }) => q(`select submit_application($1, 'x', 'y@x.co', null, $2)`, [cycle.id, `{${media}}`])), /permission denied/);
  const n = await db.as(mediaExec, ({ q }) => q(`select 1 from notifications where type = 'new_application'`));
  assert.equal(n.length, 1, 'Executives of chosen teams are told');
});

test('who sees applications: chosen teams and their Curator, not other teams or Associates', async () => {
  const a = await apply('see@x.co', [campaigns]);
  const sees = (who) => db.as(who, ({ q }) => q(`select id from applications where id = $1`, [a.application_id])).then((r) => r.length === 1);
  assert.equal(await sees(campaignsExec), true);
  assert.equal(await sees(mktCurator), true);
  assert.equal(await sees(chairman), true);
  assert.equal(await sees(mediaExec), false);
  assert.equal(await sees(talksCurator), false);
  assert.equal(await sees(mediaAssoc), false);
});

test('stages: only Curators decide; rejections stay hidden until released (FR-4.3, FR-4.6)', async () => {
  const a = await apply('rej@x.co', [media]);
  const b = await apply('scr@x.co', [media]);
  await rejects(db.as(mediaExec, ({ q }) => q(`select set_application_stage($1, 'screened')`, [`{${b.application_id}}`])), /not_allowed/);

  const toEmail = await db.as(mktCurator, ({ one }) => one(
    `select set_application_stage($1, 'rejected') as r`, [`{${a.application_id}}`])).then((x) => x.r);
  assert.deepEqual(toEmail, [], 'rejection held back');
  assert.equal((await status(a.status_token)).stage, 'in_review');

  const bulk = await db.as(mktCurator, ({ one }) => one(
    `select set_application_stage($1, 'screened') as r`, [`{${b.application_id}}`])).then((x) => x.r);
  assert.equal(bulk[0].applicant_email, 'scr@x.co');

  const released = await db.as(mktCurator, ({ one }) => one(`select release_rejections($1) as r`, [cycle.id])).then((x) => x.r);
  assert.deepEqual(released.map((r) => r.applicant_email), ['rej@x.co']);
  assert.equal((await status(a.status_token)).stage, 'not_selected');
  const again = await db.as(mktCurator, ({ one }) => one(`select release_rejections($1) as r`, [cycle.id])).then((x) => x.r);
  assert.deepEqual(again, [], 'no double emails');
});

test('interviews: applicants book directly after applying, then Executives score (FR-4.4)', async () => {
  const a = await apply('int@x.co', [media]);
  const slot = await db.as(mediaExec, ({ one }) => one(
    `insert into interview_slots (cycle_id, team_id, starts_at, ends_at, interviewer_ids) values ($1, $2, now() + interval '2 days', now() + interval '2 days 20 minutes', $3) returning id`,
    [cycle.id, media, `{${mediaExec}}`]));
  const s = await status(a.status_token);
  assert.equal(s.stage, 'received');
  assert.equal(s.open_slots.length, 1);
  await db.as('anon', ({ q }) => q(`select book_interview_slot($1, $2)`, [a.status_token, slot.id]));
  assert.equal((await status(a.status_token)).stage, 'interview');
  assert.ok((await status(a.status_token)).interview.slot_id === slot.id);

  const other = await apply('int2@x.co', [media]);
  await db.as(mktCurator, ({ q }) => q(`select set_application_stage($1, 'interview')`, [`{${other.application_id}}`]));
  await rejects(db.as('anon', ({ q }) => q(`select book_interview_slot($1, $2)`, [other.status_token, slot.id])), /slot_taken/);

  await db.as(mediaExec, ({ q }) => q(`insert into interview_scores (application_id, score, notes) values ($1, 8.5, 'Strong portfolio')`, [a.application_id]));
  await rejects(db.as(campaignsExec, ({ q }) => q(`insert into interview_scores (application_id, score) values ($1, 5)`, [a.application_id])), /row-level security/);
  const scores = await db.as(mktCurator, ({ q }) => q(`select score from interview_scores where application_id = $1`, [a.application_id]));
  assert.equal(Number(scores[0].score), 8.5);
});

test('accept → Associate invite in one step; first login lands them in the team (FR-4.5)', async () => {
  const a = await apply('joiner@student.guc.edu.eg', [media, campaigns]);
  await rejects(db.as(talksCurator, ({ q }) => q(`select accept_application($1)`, [a.application_id])), /not_allowed/);
  const r = await db.as(mktCurator, ({ one }) => one(`select accept_application($1, $2) as r`, [a.application_id, campaigns])).then((x) => x.r);
  assert.equal(r.team, 'Campaigns and Copyrights');
  assert.equal((await status(a.status_token)).stage, 'accepted');

  const user = await db.one(`insert into auth.users (email) values ('joiner@student.guc.edu.eg') returning id`);
  const m = await db.one(`select role, team_id from memberships where user_id = $1`, [user.id]);
  assert.deepEqual(m, { role: 'associate', team_id: campaigns });
});

test('withdraw by link frees the interview slot', async () => {
  const a = await apply('wd@x.co', [media]);
  await db.as('anon', ({ q }) => q(`select withdraw_application($1)`, [a.status_token]));
  assert.equal((await status(a.status_token)).stage, 'withdrawn');
  // Withdrawal does not release their identity for a second application.
  await rejects(apply('wd@x.co', [media]), /already_applied/);
});

test('board plans: candidates draft and submit their own; only the Chairman reads and scores (FR-4.7)', async () => {
  const board = await db.as(chairman, ({ one }) => one(
    `insert into recruitment_cycles (name, kind, opens_at, closes_at) values ('Board 2028', 'board', now() - interval '1 day', now() + interval '5 days') returning id`));
  const plan = await db.as(mediaAssoc, ({ one }) => one(
    `insert into board_plans (cycle_id, target_role, team_id, answers) values ($1, 'executive', $2, '{"mission": "Grow the team"}') returning id`, [board.id, media]));
  await rejects(db.as(mediaAssoc, ({ q }) => q(`update board_plans set score = 10 where id = $1`, [plan.id])), /permission denied/);
  await rejects(db.as(chairman, ({ q }) => q(`select score_board_plan($1, 8)`, [plan.id])), /plan_not_submitted/);

  await db.as(mediaAssoc, ({ q }) => q(`update board_plans set status = 'submitted' where id = $1`, [plan.id]));
  const locked = await db.as(mediaAssoc, ({ q }) => q(`update board_plans set answers = '{}' where id = $1 returning id`, [plan.id]));
  assert.equal(locked.length, 0, 'no edits after submitting');

  assert.equal((await db.as(mktCurator, ({ q }) => q(`select 1 from board_plans`))).length, 0);
  await rejects(db.as(mktCurator, ({ q }) => q(`select score_board_plan($1, 8)`, [plan.id])), /not_allowed/);
  await db.as(chairman, ({ q }) => q(`select score_board_plan($1, 8, 'Clear KPIs')`, [plan.id]));
  const p = await db.as(mediaAssoc, ({ one }) => one(`select status, submitted_at, score from board_plans where id = $1`, [plan.id]));
  assert.equal(p.status, 'submitted');
  assert.ok(p.submitted_at);
  assert.equal(Number(p.score), 8);
});

test('applicant data is purged 6 months after the cycle closes, except accepted (FR-4.8)', async () => {
  const old = await db.one(
    `insert into recruitment_cycles (name, opens_at, closes_at) values ('Old', now() - interval '1 year', now() - interval '7 months') returning id`);
  await db.q(
    `insert into applications (cycle_id, applicant_name, applicant_email, team_choices, cv_path, status_token_hash, consent_at, stage)
     values ($1, 'Old A', 'olda@x.co', $2, 'cv/x/a.pdf', 'h1', now(), 'rejected'),
            ($1, 'Old B', 'oldb@x.co', $2, null, 'h2', now(), 'accepted')`, [old.id, `{${media}}`]);
  const paths = await db.as('service', ({ one }) => one(`select purge_old_applications() as p`)).then((x) => x.p);
  assert.deepEqual(paths, ['cv/x/a.pdf']);
  const left = await db.q(`select applicant_name from applications where cycle_id = $1`, [old.id]);
  assert.deepEqual(left.map((r) => r.applicant_name), ['Old B']);
});
