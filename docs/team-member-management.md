# Team member management

The Teams page now has an Add Member selector for existing active club members and a named removal confirmation. Invitations continue to create accounts through the existing flow. Successful changes refresh both the roster and the signed-in member's permissions; failed refreshes can be retried without repeating the mutation.

| Actor | Team assignments they can manage |
| --- | --- |
| Chairman | Any active member, any current-season team, including board roles |
| Curator | Executives and Associates in their division or already assigned to its teams, within that division only |
| Executive | Associates in their primary team; can add unassigned Associates from the same division, but cannot pull members from other teams |
| Associate / inactive member / guest | None |

Roles remain club roles. Assigning an Executive to a second team does not grant leadership of that team. Removing the primary assignment leaves the primary team empty rather than promoting a secondary assignment. The club membership, home division, user account and all other team assignments remain intact.

## Database

Apply `supabase/migrations/20261026000021_team_member_management.sql` before deploying the frontend. It adds `team_memberships` linked to existing season memberships, backfills primary assignments, and synchronizes the existing invitation and primary-team update flow. It permits active Executives and Associates to remain unassigned.

The `add_team_member` and `remove_team_member` RPCs enforce hierarchy, active-season scope and uniqueness, lock relevant membership rows, and keep audit records. Authenticated clients have read-only access to the assignment table and roster view. Direct mutations cannot bypass RPC checks.

Team visibility, task assignee validation, team announcement audiences and meeting roll call use the assignments. Meeting attendance authority is checked against the meeting's team to prevent a shared member from exposing another team's records. Club roles and primary leadership powers retain the existing authorization model.

## Files and validation

- `web/src/app/portal/team/page.tsx`: existing Teams UI, searchable selector, eligible removal controls, empty states and confirmations.
- `web/src/lib/roles.ts`, `types.ts`, `api/types.ts`, `api/supabase-api.ts`, `api/demo-api.ts`, `api/phase2-demo.ts`, `api/errors.ts`: shared eligibility, assignment data, RPCs, demo behavior and error messages.
- `PortalContext.tsx`, `NewTaskModal.tsx`, `TaskSheet.tsx`, `admin/StructureTab.tsx`: roster refresh, assignment selectors and team counts.
- `tests/db/team-members.test.mjs`: role matrix, direct API/table bypasses, account preservation, multi-team removal, secondary leadership isolation, task/announcement/attendance integration and inactive/cross-season rejection.
- `tests/functions/team-permissions.test.ts`: UI permission matrix and eligibility boundaries.

Run `npm test` from the repository root, then `npm run typecheck` and `npm run build` from `web`. Existing database suites cover invitation acceptance, authentication, role changes and season preparation alongside tasks, attendance, events and other portal features. Browser interaction and visual checks require an authenticated browser session.
