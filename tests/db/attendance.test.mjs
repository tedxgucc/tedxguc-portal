// Meetings, taking attendance, QR check-in, excuses, absence levels.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mktCurator, mediaExec, campaignsExec, a1, a2, a3, other, media;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mktCurator = await db.member('curator', 'marketing');
  mediaExec = await db.member('executive', 'media_design');
  campaignsExec = await db.member('executive', 'campaigns_copyrights');
  a1 = await db.member('associate', 'media_design', { name: 'Aya' });
  a2 = await db.member('associate', 'media_design', { name: 'Bilal' });
  a3 = await db.member('associate', 'media_design', { name: 'Celine' });
  other = await db.member('associate', 'coaching');
  media = await db.team('media_design');
});

async function meeting(startsAgo = '1 hour', type = 'team_meeting', by = mediaExec, team = media) {
  return db.as(by, ({ one }) => one(
    `insert into meetings (type, title, team_id, starts_at, slot) values ($1, 'Weekly', $2, now() - $3::interval, 'Slot 3') returning id`,
    [type, team, startsAgo]));
}
const mark = (who, meetingId, marks) =>
  db.as(who, ({ one }) => one(`select submit_attendance($1, $2) as n`, [meetingId, JSON.stringify(marks)])).then((x) => x.n);

test('meetings: Executives schedule for their team; expected members are told (FR-7.1)', async () => {
  await rejects(db.as(a1, ({ q }) => q(`insert into meetings (type, title, team_id, starts_at) values ('team_meeting', 'x', $1, now())`, [media])), /row-level security/);
  const m = await meeting('0 minutes');
  const n = await db.as(a1, ({ q }) => q(`select title from notifications where type = 'meeting_scheduled'`));
  assert.equal(n.length, 1);
  assert.equal((await db.as(other, ({ q }) => q(`select id from meetings where id = $1`, [m.id]))).length, 0);
  await rejects(db.as(mediaExec, ({ q }) => q(`select qr_secret from meetings`)), /permission denied/);
});

test('roll call lists own associates; marks save instantly (FR-7.4)', async () => {
  const m = await meeting();
  const list = await db.as(mediaExec, ({ q }) => q(`select name from meeting_roll_call($1)`, [m.id]));
  assert.deepEqual(list.map((r) => r.name), ['Aya', 'Bilal', 'Celine']);
  assert.equal((await db.as(campaignsExec, ({ q }) => q(`select 1 from meeting_roll_call($1)`, [m.id]))).length, 0);

  const n = await mark(mediaExec, m.id, [
    { user_id: a1, status: 'attended' }, { user_id: a2, status: 'late' }, { user_id: a3, status: 'absent', note: 'No show' },
  ]);
  assert.equal(n, 3);
  const mine = await db.as(a3, ({ q }) => q(`select status from my_attendance()`));
  assert.deepEqual(mine.map((r) => r.status), ['absent']);
  await rejects(mark(campaignsExec, m.id, [{ user_id: a1, status: 'absent' }]), /not_allowed/);
  await rejects(mark(mediaExec, m.id, [{ user_id: other, status: 'absent' }]), /not_expected/);
  // Associates only see their own record.
  assert.equal((await db.as(a1, ({ q }) => q(`select user_id from attendance`))).length, 1);
});

test('Executives can correct for 48 h, then only the Curator can (FR-7.4)', async () => {
  const m = await meeting();
  await mark(mediaExec, m.id, [{ user_id: a1, status: 'absent' }]);
  await mark(mediaExec, m.id, [{ user_id: a1, status: 'attended' }]);
  await db.q(`update attendance set first_marked_at = now() - interval '49 hours' where meeting_id = $1`, [m.id]);
  await rejects(mark(mediaExec, m.id, [{ user_id: a1, status: 'late' }]), /edit_window_closed/);
  assert.equal(await mark(mktCurator, m.id, [{ user_id: a1, status: 'late' }]), 1);
  const log = await db.as(chairman, ({ q }) => q(`select count(*)::int as n from audit_log where target_type = 'attendance'`));
  assert.ok(log[0].n >= 3, 'attendance changes are audited');
});

test('QR check-in: right code marks attended, late after 15 min, never overwrites manual marks', async () => {
  const m = await meeting('5 minutes');
  const { code } = await db.as(mediaExec, ({ one }) => one(`select meeting_qr($1) as r`, [m.id])).then((x) => x.r);
  assert.match(code, /^[0-9a-f]{10}$/);
  await rejects(db.as(a1, ({ q }) => q(`select meeting_check_in($1, 'wrong')`, [m.id])), /invalid_code/);
  await rejects(db.as(other, ({ q }) => q(`select meeting_check_in($1, $2)`, [m.id, code])), /not_expected/);
  await rejects(db.as(a1, ({ q }) => q(`select meeting_qr($1)`, [m.id])), /not_allowed/);
  const r = await db.as(a1, ({ one }) => one(`select meeting_check_in($1, $2) as r`, [m.id, code])).then((x) => x.r);
  assert.deepEqual(r, { result: 'ok', status: 'attended' });

  await mark(mediaExec, m.id, [{ user_id: a2, status: 'absent' }]);
  const kept = await db.as(a2, ({ one }) => one(`select meeting_check_in($1, $2) as r`, [m.id, code])).then((x) => x.r);
  assert.deepEqual(kept, { result: 'already_marked', status: 'absent' });

  const lateMeeting = await meeting('20 minutes');
  const late = await db.as(mediaExec, ({ one }) => one(`select meeting_qr($1) as r`, [lateMeeting.id])).then((x) => x.r);
  const r2 = await db.as(a3, ({ one }) => one(`select meeting_check_in($1, $2) as r`, [lateMeeting.id, late.code])).then((x) => x.r);
  assert.equal(r2.status, 'late');
});

test('excuses: sent within 48 h, accepted by the Executive, then excused (FR-7.7)', async () => {
  const m = await meeting();
  await mark(mediaExec, m.id, [{ user_id: a2, status: 'absent' }]);
  const ex = await db.as(a2, ({ one }) => one(`insert into excuses (meeting_id, note) values ($1, 'Exam') returning id`, [m.id]));
  await rejects(db.as(campaignsExec, ({ q }) => q(`select decide_excuse($1, true)`, [ex.id])), /not_allowed/);
  await db.as(mediaExec, ({ q }) => q(`select decide_excuse($1, true)`, [ex.id]));
  const s = await db.as(a2, ({ one }) => one(`select status from attendance where meeting_id = $1 and user_id = auth.uid()`, [m.id]));
  assert.equal(s.status, 'excused');

  const old = await meeting('3 days');
  await rejects(db.as(a2, ({ q }) => q(`insert into excuses (meeting_id, note) values ($1, 'Late excuse')`, [old.id])), /row-level security/);
});

test('absence levels: absences + every 2 lates; warnings at level 2, Curator at level 3 (FR-7.6)', async () => {
  const fresh = await createDb();
  await fresh.member('chairman');
  const cur = await fresh.member('curator', 'marketing');
  const ex = await fresh.member('executive', 'media_design');
  const as = await fresh.member('associate', 'media_design');
  const team = await fresh.team('media_design');
  const mk = async (status) => {
    const m = await fresh.as(ex, ({ one }) => one(
      `insert into meetings (type, title, team_id, starts_at) values ('team_meeting', 'M', $1, now() - interval '1 hour') returning id`, [team]));
    await fresh.as(ex, ({ q }) => q(`select submit_attendance($1, $2)`, [m.id, JSON.stringify([{ user_id: as, status }])]));
  };
  const level = () => fresh.as(as, ({ one }) => one(`select attendance_summary() as r`)).then((x) => x.r.overall_level);

  await mk('late');
  assert.equal(await level(), 0);
  await mk('late');
  assert.equal(await level(), 1, 'two lates = one absence');
  await mk('excused');
  assert.equal(await level(), 1, 'excused never counts');
  await mk('absent');
  assert.equal(await level(), 2);
  assert.equal((await fresh.as(as, ({ q }) => q(`select 1 from notifications where type = 'absence_warning'`))).length, 1);
  assert.equal((await fresh.as(cur, ({ q }) => q(`select 1 from notifications where type = 'absence_level'`))).length, 0);
  await mk('absent');
  assert.equal(await level(), 3);
  assert.equal((await fresh.as(cur, ({ q }) => q(`select 1 from notifications where type = 'absence_level'`))).length, 1);
  await mk('absent');
  assert.equal((await fresh.as(as, ({ q }) => q(`select 1 from notifications where type = 'absence_warning'`))).length, 1, 'warned once');

  const summary = await fresh.as(as, ({ one }) => one(`select attendance_summary() as r`)).then((x) => x.r);
  assert.deepEqual(summary.types[0], { type: 'team_meeting', attended: 0, late: 2, absent: 3, excused: 1, level: 4 });
  const history = await fresh.as(as, ({ q }) => q(`select n from my_attendance('team_meeting')`));
  assert.deepEqual(history.map((r) => Number(r.n)), [6, 5, 4, 3, 2, 1], 'numbered, newest first');
});

test('rates per member and per meeting, for the right people only (FR-7.5)', async () => {
  const marketing = await db.division('marketing');
  const rows = await db.as(mktCurator, ({ q }) => q(`select name, rate from attendance_rates(null, $1) where name = 'Aya'`, [marketing]));
  assert.equal(rows.length, 1);
  assert.ok(Number(rows[0].rate) > 0);
  await rejects(db.as(campaignsExec, ({ q }) => q(`select * from attendance_rates(null, $1)`, [marketing])), /not_allowed/);
  assert.ok((await db.as(mediaExec, ({ q }) => q(`select * from meeting_attendance_rates($1)`, [media]))).length >= 1);
  await rejects(db.as(a1, ({ q }) => q(`select attendance_summary($1)`, [a2])), /not_allowed/);
});

test('board meetings expect Executives and Curators; the Chairman marks Curators', async () => {
  const m = await db.as(chairman, ({ one }) => one(
    `insert into meetings (type, title, starts_at) values ('board_meeting', 'Board', now() - interval '1 hour') returning id`));
  const list = await db.as(chairman, ({ q }) => q(`select user_id from meeting_roll_call($1)`, [m.id]));
  assert.deepEqual(new Set(list.map((r) => r.user_id)), new Set([mktCurator, mediaExec, campaignsExec]));
  const curatorList = await db.as(mktCurator, ({ q }) => q(`select user_id from meeting_roll_call($1)`, [m.id]));
  assert.deepEqual(new Set(curatorList.map((r) => r.user_id)), new Set([mediaExec, campaignsExec]));
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into meetings (type, title, starts_at) values ('board_meeting', 'x', now())`)), /row-level security/);
});

test('meetings show on the calendar for the right people (FR-15.7)', async () => {
  const from = new Date(Date.now() - 2 * 86400_000).toISOString();
  const to = new Date(Date.now() + 86400_000).toISOString();
  const mine = await db.as(a1, ({ q }) => q(`select source from calendar_feed($1, $2) where source = 'meeting'`, [from, to]));
  assert.ok(mine.length >= 1);
  const theirs = await db.as(other, ({ q }) => q(`select source from calendar_feed($1, $2) where source = 'meeting'`, [from, to]));
  assert.equal(theirs.length, 0);
});
