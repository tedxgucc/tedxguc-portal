// Announcements, calendar, public site content, rate limits.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, mktCurator, talksCurator, mediaExec, mediaAssoc, campaignsAssoc, coachingAssoc;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  mktCurator = await db.member('curator', 'marketing');
  talksCurator = await db.member('curator', 'talks');
  mediaExec = await db.member('executive', 'media_design');
  mediaAssoc = await db.member('associate', 'media_design');
  campaignsAssoc = await db.member('associate', 'campaigns_copyrights');
  coachingAssoc = await db.member('associate', 'coaching');
});

const sees = (who, table, id) =>
  db.as(who, ({ q }) => q(`select id from ${table} where id = $1`, [id])).then((r) => r.length === 1);

test('announcements reach exactly their audience (FR-8.1)', async () => {
  const media = await db.team('media_design');
  const marketing = await db.division('marketing');

  const teamPost = await db.as(mediaExec, ({ one }) => one(
    `insert into announcements (audience_type, team_id, title, body) values ('team', $1, 'Shoot Friday', 'Bring cameras') returning id`, [media]));
  assert.equal(await sees(mediaAssoc, 'announcements', teamPost.id), true);
  assert.equal(await sees(mktCurator, 'announcements', teamPost.id), true, 'curator of the division');
  assert.equal(await sees(campaignsAssoc, 'announcements', teamPost.id), false);

  const divPost = await db.as(mktCurator, ({ one }) => one(
    `insert into announcements (audience_type, division_id, title, body) values ('division', $1, 'Marketing sync', '...') returning id`, [marketing]));
  assert.equal(await sees(campaignsAssoc, 'announcements', divPost.id), true);
  assert.equal(await sees(coachingAssoc, 'announcements', divPost.id), false);

  const rolePost = await db.as(chairman, ({ one }) => one(
    `insert into announcements (audience_type, audience_role, title, body) values ('role', 'executive', 'Execs only', '...') returning id`));
  assert.equal(await sees(mediaExec, 'announcements', rolePost.id), true);
  assert.equal(await sees(mediaAssoc, 'announcements', rolePost.id), false);

  // Notifications went to the audience, not the author.
  const n = await db.as(mediaAssoc, ({ q }) => q(`select title from notifications where type = 'announcement' order by created_at`));
  assert.deepEqual(n.map((x) => x.title), ['Shoot Friday', 'Marketing sync']);
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select 1 from notifications where title = 'Shoot Friday'`))).length, 0);
});

test('who may post where (FR-8.1, matrix)', async () => {
  const coaching = await db.team('coaching');
  const media = await db.team('media_design');
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into announcements (audience_type, title, body) values ('all', 'x', 'x')`)), /row-level security/);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into announcements (audience_type, team_id, title, body) values ('team', $1, 'x', 'x')`, [coaching])), /row-level security/);
  await rejects(db.as(mktCurator, ({ q }) => q(`insert into announcements (audience_type, team_id, title, body) values ('team', $1, 'x', 'x')`, [coaching])), /row-level security/);
  await rejects(db.as(mediaAssoc, ({ q }) => q(`insert into announcements (audience_type, team_id, title, body) values ('team', $1, 'x', 'x')`, [media])), /row-level security/);
  await db.as(chairman, ({ q }) => q(`insert into announcements (audience_type, title, body) values ('all', 'Welcome', 'Hello all')`));
});

test('read confirmations: members confirm, authors see who read', async () => {
  const media = await db.team('media_design');
  const post = await db.as(mediaExec, ({ one }) => one(
    `insert into announcements (audience_type, team_id, title, body, needs_confirmation) values ('team', $1, 'Rules', 'Read me', true) returning id`, [media]));
  await db.as(mediaAssoc, ({ q }) => q(`insert into announcement_reads (announcement_id) values ($1)`, [post.id]));
  await rejects(db.as(coachingAssoc, ({ q }) => q(`insert into announcement_reads (announcement_id) values ($1)`, [post.id])), /row-level security/);
  const reads = await db.as(mediaExec, ({ q }) => q(`select user_id from announcement_reads where announcement_id = $1`, [post.id]));
  assert.deepEqual(reads.map((r) => r.user_id), [mediaAssoc]);
});

test('calendar: team entries stay in the team; Associates are view-only (FR-15.2–15.5)', async () => {
  const media = await db.team('media_design');
  const coaching = await db.team('coaching');
  const entry = await db.as(mediaExec, ({ one }) => one(
    `insert into calendar_entries (team_id, visibility, title, starts_at) values ($1, 'team', 'Media shoot', now() + interval '2 days') returning id`, [media]));
  assert.equal(await sees(mediaAssoc, 'calendar_entries', entry.id), true);
  assert.equal(await sees(mktCurator, 'calendar_entries', entry.id), true);
  assert.equal(await sees(chairman, 'calendar_entries', entry.id), true);
  assert.equal(await sees(campaignsAssoc, 'calendar_entries', entry.id), false);
  assert.equal(await sees(talksCurator, 'calendar_entries', entry.id), false);

  await rejects(db.as(mediaExec, ({ q }) => q(`insert into calendar_entries (visibility, title, starts_at) values ('club', 'x', now())`)), /row-level security/);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into calendar_entries (team_id, visibility, title, starts_at) values ($1, 'team', 'x', now())`, [coaching])), /row-level security/);
  await rejects(db.as(mediaAssoc, ({ q }) => q(`insert into calendar_entries (team_id, visibility, title, starts_at) values ($1, 'team', 'x', now())`, [media])), /row-level security/);
  // A Curator may add a team entry for a team in their own division (FR-15.3).
  await db.as(mktCurator, ({ q }) => q(`insert into calendar_entries (team_id, visibility, title, starts_at) values ($1, 'team', 'Review', now())`, [media]));
  await rejects(db.as(talksCurator, ({ q }) => q(`insert into calendar_entries (team_id, visibility, title, starts_at) values ($1, 'team', 'x', now())`, [media])), /row-level security/);
});

test('calendar: public entries and listed events show to guests without login (FR-15.8)', async () => {
  const opsCurator = await db.member('curator', 'operations');
  await db.as(chairman, ({ q }) => q(`insert into calendar_entries (visibility, title, starts_at) values ('public', 'Open day', now() + interval '3 days')`));
  await db.as(chairman, ({ q }) => q(`insert into calendar_entries (visibility, title, starts_at) values ('club', 'General assembly', now() + interval '3 days')`));
  await db.as(opsCurator, ({ q }) => q(
    `insert into events (type, title, starts_at, license_status, status) values ('main_event', 'Main Event', now() + interval '5 days', 'licensed', 'published')`));

  const from = new Date().toISOString();
  const to = new Date(Date.now() + 10 * 86400_000).toISOString();
  const guest = await db.as('anon', ({ q }) => q(`select source, title from calendar_feed($1, $2)`, [from, to]));
  assert.deepEqual(guest.map((r) => r.title).sort(), ['Main Event', 'Open day']);

  const member = await db.as(coachingAssoc, ({ q }) => q(`select title from calendar_feed($1, $2)`, [from, to]));
  const titles = member.map((r) => r.title);
  assert.ok(titles.includes('General assembly') && titles.includes('Main Event'));
  assert.ok(!titles.includes('Media shoot'), 'other team entry hidden');
});

test('calendar feed includes my task deadlines only (FR-15.7)', async () => {
  const media = await db.team('media_design');
  const deadline = new Date(Date.now() + 86400_000).toISOString();
  await db.as(mediaExec, async ({ one, q }) => {
    const t = await one(`insert into tasks (team_id, title, deadline) values ($1, 'Teaser video', $2) returning id`, [media, deadline]);
    await q(`insert into task_assignees (task_id, user_id) values ($1, $2)`, [t.id, mediaAssoc]);
  });
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 3 * 86400_000).toISOString();
  const mine = await db.as(mediaAssoc, ({ q }) => q(`select title from calendar_feed($1, $2) where source = 'task_deadline'`, [from, to]));
  assert.deepEqual(mine.map((r) => r.title), ['Due: Teaser video']);
  const other = await db.as(campaignsAssoc, ({ q }) => q(`select title from calendar_feed($1, $2) where source = 'task_deadline'`, [from, to]));
  assert.equal(other.length, 0);
});

test('.ics feed token: works for the owner only, old token dies on rotate (FR-15.9)', async () => {
  const from = new Date(Date.now() - 86400_000).toISOString();
  const to = new Date(Date.now() + 30 * 86400_000).toISOString();
  const t1 = await db.as(mediaAssoc, ({ one }) => one(`select rotate_calendar_feed_token() as t`)).then((r) => r.t);
  const feed = await db.as('service', ({ q }) => q(`select title from calendar_feed_for_token($1, $2, $3)`, [t1, from, to]));
  assert.ok(feed.some((r) => r.title === 'Media shoot'));
  await rejects(db.as(mediaAssoc, ({ q }) => q(`select * from calendar_feed_for_token($1, $2, $3)`, [t1, from, to])), /permission denied/);
  const t2 = await db.as(mediaAssoc, ({ one }) => one(`select rotate_calendar_feed_token() as t`)).then((r) => r.t);
  assert.notEqual(t1, t2);
  assert.equal((await db.as('service', ({ q }) => q(`select 1 from calendar_feed_for_token($1, $2, $3)`, [t1, from, to]))).length, 0);
});

test('site sections: Curators edit only their own division section (FR-1, matrix)', async () => {
  await db.as(chairman, ({ q }) => q(
    `update site_sections set is_published = false where key = 'faq'`));
  // The seed starts every section; the Chairman can still add new ones.
  await db.as(chairman, ({ q }) => q(`insert into site_sections (key, owner_kind, title, is_published) values ('hidden_note', null, 'Note', false)`));
  const ok = await db.as(talksCurator, ({ q }) => q(`update site_sections set title = 'Our talks' where key = 'talks' returning key`));
  assert.equal(ok.length, 1);
  const no = await db.as(mktCurator, ({ q }) => q(`update site_sections set title = 'x' where key = 'talks' returning key`));
  assert.equal(no.length, 0);
  await rejects(db.as(talksCurator, ({ q }) => q(`update site_sections set owner_kind = 'marketing' where key = 'talks'`)), /permission denied/);
  const guest = await db.as('anon', ({ q }) => q(`select key from site_sections`));
  const keys = guest.map((r) => r.key);
  assert.ok(keys.includes('talks'));
  assert.ok(!keys.includes('faq') && !keys.includes('hidden_note'), 'unpublished sections hidden from guests');
});

test('rate limit allows N hits per window, then blocks', async () => {
  const hit = () => db.as('service', ({ one }) => one(`select hit_rate_limit('ip:1.2.3.4', 3, 600) as ok`)).then((r) => r.ok);
  assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
  await rejects(db.as('anon', ({ q }) => q(`select hit_rate_limit('x', 1, 60)`)), /permission denied/);
});
