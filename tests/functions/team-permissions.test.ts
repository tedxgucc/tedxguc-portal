import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageTeamMember, isInTeam } from '../../web/src/lib/roles.ts';
import type { Me, Member, Role, Team } from '../../web/src/lib/types.ts';

const own: Team = { id: 'own', division_id: 'division', name: 'Own', kind: 'other' };
const sibling: Team = { ...own, id: 'sibling' };
const outside: Team = { ...own, id: 'outside', division_id: 'elsewhere' };
const teams = [own, sibling, outside];
const actor = (role: Role): Me => ({ id: role, role, name: role, email: '', photo_url: null, team_id: role === 'executive' ? own.id : null,
  division_id: role === 'chairman' ? null : own.division_id, team_name: null, team_kind: null, division_name: null, division_kind: null });
const member = (role: Role, team: Team | null = own): Member => ({ user_id: role, role, name: role, photo_url: null,
  team_id: team?.id ?? null, team_ids: team ? [team.id] : [], team: team?.name ?? null,
  division_id: team?.division_id ?? own.division_id, division: null, division_kind: null });

test('team controls match the hierarchy for every role and target team', () => {
  for (const targetRole of ['chairman', 'curator', 'executive', 'associate'] as Role[]) {
    for (const action of ['add', 'remove'] as const) {
      for (const team of teams) assert.equal(canManageTeamMember(actor('chairman'), team, member(targetRole), action, teams), true);
      assert.equal(canManageTeamMember(actor('curator'), own, member(targetRole), action, teams), ['associate', 'executive'].includes(targetRole));
      assert.equal(canManageTeamMember(actor('curator'), outside, member(targetRole), action, teams), false);
      assert.equal(canManageTeamMember(actor('executive'), sibling, member(targetRole), action, teams), false);
      assert.equal(canManageTeamMember(actor('associate'), own, member(targetRole), action, teams), false);
    }
    assert.equal(canManageTeamMember(actor('executive'), own, member(targetRole), 'remove', teams), targetRole === 'associate');
    assert.equal(canManageTeamMember(actor('executive'), own, member(targetRole, null), 'add', teams), targetRole === 'associate');
  }
});

test('existing other-team assignments are preserved and never treated as unassigned', () => {
  const shared = { ...member('associate', null), team_ids: [sibling.id] };
  assert.equal(isInTeam(shared, sibling.id), true);
  assert.equal(canManageTeamMember(actor('executive'), own, shared, 'add', teams), false);
  assert.equal(canManageTeamMember(actor('curator'), own, member('associate', outside), 'add', teams), false);
  assert.equal(canManageTeamMember(null, own, shared, 'add', teams), false);
});

import { canAssignTask } from '../../web/src/lib/roles.ts';

test('task assignee picker follows the delegation hierarchy and scope', () => {
  for (const role of ['chairman', 'curator', 'executive', 'associate'] as Role[]) {
    for (const target of ['chairman', 'curator', 'executive', 'associate'] as Role[]) {
      const allowed = role === 'chairman' ? ['curator', 'executive'] : role === 'curator' ? ['executive', 'associate'] : role === 'executive' ? ['associate'] : [];
      assert.equal(canAssignTask(actor(role), own, member(target)), allowed.includes(target));
      assert.equal(canAssignTask(actor(role), own, member(target, outside)), false);
    }
  }
  assert.equal(canAssignTask(actor('chairman'), own, member('curator', null)), true);
  assert.equal(canAssignTask(null, own, member('associate')), false);
});
