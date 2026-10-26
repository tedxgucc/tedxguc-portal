// During a staged deployment, the roster view may not exist yet. Preserve
// primary-team access until the migration is applied; never hide other errors.
export function rosterUnavailable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return !!e && ['PGRST205', '42P01'].includes(e.code ?? '')
    && (e.message ?? '').includes('team_roster');
}
