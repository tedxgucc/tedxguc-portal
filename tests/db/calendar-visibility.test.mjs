import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chair, curator, executive, associate, otherCurator, otherExecutive, team, sibling, division, meetings;
before(async () => {
  db = await createDb();
  chair = await db.member('chairman');
  curator = await db.member('curator', 'marketing');
  executive = await db.member('executive', 'media_design');
  associate = await db.member('associate', 'media_design');
  otherCurator = await db.member('curator', 'talks');
  otherExecutive = await db.member('executive', 'coaching');
  team = await db.team('media_design');
  sibling = await db.team('campaigns_copyrights');
  division = await db.division('marketing');
  const create = (title, type, tid = null, did = null) => db.as(chair, ({ one }) => one(`insert into meetings(title,type,team_id,division_id,starts_at) values ($1,$2,$3,$4,now()+interval '1 day') returning id`, [title, type, tid, did]));
  meetings = {
    own: await create('Own team', 'team_meeting', team),
    sibling: await create('Sibling team', 'team_meeting', sibling),
    outside: await create('Outside team', 'team_meeting', await db.team('coaching')),
    high: await create('High board', 'board_meeting'),
    division: await create('Division board', 'board_meeting', null, division),
    outsideDivision: await create('Outside division', 'board_meeting', null, await db.division('talks')),
    divisionSession: await create('Division session', 'session', null, division),
    general: await create('General meeting', 'general_assembly'),
  };
});

test('each role sees exactly the intended meetings through both RLS and calendar RPC', async () => {
  const matrix = [
    [chair, Object.keys(meetings)],
    [curator, ['own', 'sibling', 'high', 'division', 'divisionSession', 'general']],
    [executive, ['own', 'division', 'divisionSession', 'general']],
    [associate, ['own', 'general']],
    [otherCurator, ['outside', 'outsideDivision', 'high', 'general']],
    [otherExecutive, ['outside', 'outsideDivision', 'general']],
    ['anon', []],
  ];
  for (const [who, keys] of matrix) {
    const expected = keys.map((key) => meetings[key].id).sort();
    if (who === 'anon') {
      await rejects(db.as(who, ({ q }) => q(`select id from meetings`)), /permission denied/);
    }
    const direct = who === 'anon' ? [] : await db.as(who, ({ q }) => q(`select id from meetings`));
    assert.deepEqual(direct.map((r) => r.id).sort(), expected, `direct access for ${who}`);
    const feed = await db.as(who, ({ q }) => q(`select id from calendar_feed(now(), now()+interval '2 days') where source='meeting'`));
    assert.deepEqual(feed.map((r) => r.id).sort(), expected, `feed for ${who}`);
  }
});

test('personal calendar subscriptions obey the same visibility restrictions', async () => {
  const token = await db.as(executive, ({ one }) => one(`select rotate_calendar_feed_token() as token`));
  const feed = await db.as('service', ({ q }) => q(`select id from calendar_feed_for_token($1, now(), now()+interval '2 days') where source='meeting'`, [token.token]));
  assert.deepEqual(feed.map((r) => r.id).sort(), ['own', 'division', 'divisionSession', 'general'].map((k) => meetings[k].id).sort());
});
