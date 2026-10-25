// Files and handover library.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mktCurator, mediaExec, mediaAssoc, coachingAssoc, coachingExec;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mktCurator = await db.member('curator', 'marketing');
  mediaExec = await db.member('executive', 'media_design');
  mediaAssoc = await db.member('associate', 'media_design');
  coachingAssoc = await db.member('associate', 'coaching');
  coachingExec = await db.member('executive', 'coaching');
});

async function addFile(who, scope, { team = null, division = null, handover = false } = {}) {
  const id = randomUUID();
  return db.as(who, ({ one }) => one(
    `insert into files (id, scope, team_id, division_id, name, storage_path, is_handover) values ($1, $2, $3, $4, 'doc.pdf', $5, $6) returning id, storage_path`,
    [id, scope, team, division, `${id}/doc.pdf`, handover]));
}
const sees = (who, id) => db.as(who, ({ q }) => q(`select id from files where id = $1`, [id])).then((r) => r.length === 1);

test('team files: the team sees them; others do not; Associates cannot upload (FR-9.1, FR-9.3)', async () => {
  const media = await db.team('media_design');
  const f = await addFile(mediaExec, 'team', { team: media });
  assert.equal(await sees(mediaAssoc, f.id), true);
  assert.equal(await sees(mktCurator, f.id), true);
  assert.equal(await sees(coachingAssoc, f.id), false);
  await rejects(addFile(mediaAssoc, 'team', { team: media }), /row-level security/);
  await rejects(addFile(coachingExec, 'team', { team: media }), /row-level security/);
});

test('brand kit is club-wide: Curators upload, every member reads (FR-9.2)', async () => {
  const f = await addFile(mktCurator, 'club');
  assert.equal(await sees(coachingAssoc, f.id), true);
  await rejects(addFile(mediaExec, 'club'), /row-level security/);
  assert.equal((await db.as('anon', ({ q }) => q(`select 1 from storage.objects`)).catch(() => [])).length, 0);
});

test('board files hide from Associates', async () => {
  const f = await addFile(chairman, 'board');
  assert.equal(await sees(mediaExec, f.id), true);
  assert.equal(await sees(mediaAssoc, f.id), false);
});

test('storage follows the file row: upload only to a reserved path you may write', async () => {
  const media = await db.team('media_design');
  const f = await addFile(mediaExec, 'team', { team: media });
  await db.as(mediaExec, ({ q }) => q(`insert into storage.objects (bucket_id, name) values ('files', $1)`, [f.storage_path]));
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into storage.objects (bucket_id, name) values ('files', $1)`, [`${randomUUID()}/x.pdf`])), /row-level security/);
  assert.equal((await db.as(mediaAssoc, ({ q }) => q(`select 1 from storage.objects where bucket_id = 'files'`))).length, 1);
  assert.equal((await db.as(coachingAssoc, ({ q }) => q(`select 1 from storage.objects where bucket_id = 'files'`))).length, 0);
});

test('handover status lists board members without a handover file (FR-9.4)', async () => {
  const coaching = await db.team('coaching');
  await addFile(coachingExec, 'team', { team: coaching, handover: true });
  const rows = await db.as(chairman, ({ q }) => q(`select name, handover_files from handover_status()`));
  const byName = Object.fromEntries(rows.map((r) => [r.name, Number(r.handover_files)]));
  assert.equal(byName['executive 6'], 1);
  assert.equal(byName['executive 3'], 0);
  await rejects(db.as(mktCurator, ({ q }) => q(`select * from handover_status()`)), /not_allowed/);
});
