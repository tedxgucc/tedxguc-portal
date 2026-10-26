// Role and division helpers for the screens. These only decide what to
// SHOW; the database enforces every rule again (row-level security).
import type { DivisionKind, Me, Role, Team } from './types';

// Division accent class suffix used by tx-tag / tx-kcard / tx-pill.
export function divClass(kind: DivisionKind | null | undefined): 'talks' | 'ops' | 'od' | 'mc' | null {
  switch (kind) {
    case 'talks': return 'talks';
    case 'operations': return 'ops';
    case 'org_development': return 'od';
    case 'marketing': return 'mc';
    default: return null;
  }
}

export const roleLabel: Record<Role, string> = {
  chairman: 'Chairman',
  curator: 'Curator',
  executive: 'Executive',
  associate: 'Associate',
};

export const isBoard = (me: Me | null) => me?.role === 'chairman' || me?.role === 'curator' || me?.role === 'executive';
export const isChairman = (me: Me | null) => me?.role === 'chairman';

// Chairman, the Curator of the team's division, or an Executive of the team.
export function canManageTeam(me: Me | null, team: Pick<Team, 'id' | 'division_id'> | null | undefined): boolean {
  if (!me || !team) return false;
  if (me.role === 'chairman') return true;
  if (me.role === 'curator') return me.division_id === team.division_id;
  if (me.role === 'executive') return me.team_id === team.id;
  return false;
}

// Teams this person can create tasks / team calendar entries for.
export function manageableTeams(me: Me | null, teams: Team[]): Team[] {
  return teams.filter((t) => canManageTeam(me, t));
}

export const canManageEvents = (me: Me | null) =>
  me?.role === 'chairman' || (me?.role === 'curator' && me.division_kind === 'operations');

// Door scanner: the Chairman, the Ops Curator and L&P Executives always;
// L&P Associates only on the day of an event; anyone added as door staff.
export const canScanAlways = (me: Me | null) => canManageEvents(me) || (me?.role === 'executive' && me.team_kind === 'logistics_planning');
export const isLpAssociate = (me: Me | null) => me?.role === 'associate' && me.team_kind === 'logistics_planning';
export const canScanTickets = (me: Me | null, eventToday = false) => canScanAlways(me) || (isLpAssociate(me) && eventToday);

export const canPostClubWide = (me: Me | null) => me?.role === 'chairman' || me?.role === 'curator';

// ----- Phase 2 -----
// Chairman and Operations Curator see all money and the balances.
export const isFinanceAdmin = (me: Me | null) => canManageEvents(me);
export const isLpExec = (me: Me | null) => me?.role === 'executive' && me.team_kind === 'logistics_planning';
export const isPartnershipsExec = (me: Me | null) => me?.role === 'executive' && me.team_kind === 'partnerships';
export const canRecordCashOut = (me: Me | null) => isFinanceAdmin(me) || isLpExec(me);
// Money requests: only L&P Executives ask; the Ops Curator and Chairman see and decide.
export const canRequestMoney = (me: Me | null) => isLpExec(me);
export const seesMoneyRequests = (me: Me | null) => isLpExec(me) || isFinanceAdmin(me);
export const canRecordDeposits = (me: Me | null) => isFinanceAdmin(me) || isPartnershipsExec(me);
// Who takes attendance: Executives (own team), Curators (division), the Chairman.
export const takesAttendance = (me: Me | null) => me?.role === 'executive' || me?.role === 'curator' || me?.role === 'chairman';
// Cross-team task requests: Curators and the Chairman only (migration 0012).
export const canSendTaskRequests = (me: Me | null) => me?.role === 'chairman' || me?.role === 'curator';

// ----- Admin areas -----
// Run of show: event managers and L&P Executives edit, members read.
export const canEditRunOfShow = (me: Me | null) => canManageEvents(me) || isLpExec(me);
// Site sections: the Chairman edits all; a Curator edits their division's.
export const canEditSection = (me: Me | null, owner: DivisionKind | null) =>
  me?.role === 'chairman' || (!!owner && me?.role === 'curator' && me.division_kind === owner);
export const canOpenSiteEditor = (me: Me | null) => me?.role === 'chairman' || me?.role === 'curator';
// Inquiries: partner leads go to Operations leads and Partnerships; contact messages to the Chairman and Curators.
export const seesPartnerInquiries = (me: Me | null) => canManageEvents(me) || me?.team_kind === 'partnerships';
export const seesContactInquiries = (me: Me | null) => me?.role === 'chairman' || me?.role === 'curator';
export const canOpenInbox = (me: Me | null) => seesPartnerInquiries(me) || seesContactInquiries(me);

// Sign-ups (packages, trips, anything with registration): who manages them.
export const canManageSignUps = (me: Me | null) => !!me && (me.role === 'chairman'
  || (me.role === 'curator' && (me.division_kind === 'operations' || me.division_kind === 'org_development'))
  || (me.role === 'executive' && (me.team_kind === 'logistics_planning' || me.team_kind === 'associates_experience')));

// X Access (FR-18): Partnerships Executives, the Operations Curator and the
// Chairman manage it; Partnerships Associates can view.
export const canManageXAccess = (me: Me | null) => canManageEvents(me) || (me?.role === 'executive' && me.team_kind === 'partnerships');
export const canViewXAccess = (me: Me | null) => canManageXAccess(me) || me?.team_kind === 'partnerships';
