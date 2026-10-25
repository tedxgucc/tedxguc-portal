-- =====================================================================
-- 0012 · Executives work inside their own team only.
-- Decision (Oct 2026): an Executive creates tasks for their own team
-- directly; cross-team requests (FR-6.5) are sent by Curators and the
-- Chairman only. Executives still accept or decline requests their team
-- receives.
-- =====================================================================

drop policy "Managers create tasks; teams send requests" on public.tasks;

create policy "Managers create tasks; Curators send requests" on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (requested_by_team_id is null and private.can_manage_team(team_id))
      or (requested_by_team_id is not null
          and private.can_manage_division(private.team_division(requested_by_team_id)))
    ));
