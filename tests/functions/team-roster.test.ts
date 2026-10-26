import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterUnavailable } from '../../web/src/lib/api/team-roster.ts';

test('login tolerates only the pending roster migration, not permission or network errors', () => {
  assert.equal(rosterUnavailable({ code: 'PGRST205', message: "Could not find the table 'public.team_roster' in the schema cache" }), true);
  assert.equal(rosterUnavailable({ code: '42P01', message: 'relation "public.team_roster" does not exist' }), true);
  assert.equal(rosterUnavailable({ code: '42501', message: 'permission denied for team_roster' }), false);
  assert.equal(rosterUnavailable({ code: 'PGRST205', message: 'Could not find users' }), false);
  assert.equal(rosterUnavailable({ message: 'Failed to fetch' }), false);
  assert.equal(rosterUnavailable(null), false);
});
