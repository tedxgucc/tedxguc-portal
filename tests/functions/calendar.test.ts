import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicCalendarEvents } from '../../web/src/lib/calendar.ts';
import { canSeeMeeting } from '../../web/src/lib/roles.ts';
import type { Me, TxEvent, Team } from '../../web/src/lib/types.ts';

test('public calendar contains upcoming published public events only', () => {
  const event = { id: 'upcoming', title: 'Event', is_public: true, status: 'published', license_status: 'licensed', starts_at: '2030-06-15T12:00:00Z', ends_at: null, venue: 'Cairo' } as TxEvent;
  const cases = [event, { ...event, id: 'private', is_public: false }, { ...event, id: 'past', starts_at: '2030-06-01T12:00:00Z' },
    { ...event, id: 'draft', status: 'draft' as const }, { ...event, id: 'cancelled', status: 'cancelled' as const },
    { ...event, id: 'pending', license_status: 'pending' as const }, { ...event, id: 'later', starts_at: '2030-08-01T12:00:00Z' }];
  const feed = publicCalendarEvents(cases, '2030-06-01T00:00:00Z', '2030-07-01T00:00:00Z', '2030-06-10T00:00:00Z');
  assert.deepEqual(feed.map((x) => x.id), ['upcoming']);
  assert.ok(feed.every((x) => x.source === 'event' && x.visibility === 'public'));
});

test('UI meeting visibility matches high board, division, team and general rules', () => {
  const team: Team = { id: 'team', division_id: 'division', name: 'Team', kind: 'other' };
  const meeting = (type: string, team_id: string | null = null, division_id: string | null = null) => ({ type, team_id, division_id });
  for (const role of ['chairman', 'curator', 'executive', 'associate'] as const) {
    const me = { role, team_id: team.id, division_id: team.division_id } as Me;
    assert.equal(canSeeMeeting(me, meeting('general_assembly'), [team]), true);
    assert.equal(canSeeMeeting(me, meeting('team_meeting', team.id), [team]), true);
    assert.equal(canSeeMeeting(me, meeting('board_meeting'), [team]), ['chairman', 'curator'].includes(role));
    assert.equal(canSeeMeeting(me, meeting('board_meeting', null, 'division'), [team]), role !== 'associate');
    assert.equal(canSeeMeeting(me, meeting('session', null, 'other'), [team]), role === 'chairman');
  }
  assert.equal(canSeeMeeting(null, meeting('general_assembly'), [team]), false);
});
