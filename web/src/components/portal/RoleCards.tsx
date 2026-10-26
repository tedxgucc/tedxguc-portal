'use client';
// Dashboard cards for money, recruitment and sign-ups, per the requirements.
// "Role dashboards" table:
//   (Attendance was removed: no absence or excuse cards.)
//   Curator   → requests to approve + division budget left
//   Chairman  → approvals waiting + total balance
//   L&P       → cash outs missing a fatora
import { ClipboardCheck, Package, UserSearch, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { financeApi } from '@/lib/api/phase2';
import { packagesApi, recruitmentApi } from '@/lib/api/phase2b';
import { egp } from '@/lib/format';
import { canManageSignUps, isFinanceAdmin, isLpExec } from '@/lib/roles';
import { usePortal } from './PortalContext';

export function RoleCards() {
  const { me, teams } = usePortal();
  const [toApprove, setToApprove] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [missing, setMissing] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<number | null>(null);
  const [ordersToCheck, setOrdersToCheck] = useState<number | null>(null);

  useEffect(() => {
    if (isFinanceAdmin(me)) {
      financeApi.listExpenseRequests().then((list) => setToApprove(list.filter((r) => (me.role === 'chairman' ? ['awaiting_chairman', 'submitted'].includes(r.status)
        : r.status === 'submitted')).length)).catch(() => {});
    }
    if (me.role === 'curator' && me.division_id) financeApi.divisionBudget(me.division_id).then((b) => setLeft(b.remaining)).catch(() => {});
    if (isFinanceAdmin(me)) financeApi.balances().then((b) => { setTotal(b.bank + b.cash + b.telda); setMissing(b.cash_outs_missing_fatora); }).catch(() => {});
    // Recruitment: new applicants waiting (Curator dashboard: open applications).
    if (me.role === 'curator' || me.role === 'chairman') recruitmentApi.listApplications().then((a) => setApplicants(a.filter((x) => ['applied', 'screened'].includes(x.stage)).length)).catch(() => {});
    if (canManageSignUps(me)) packagesApi.listOrders().then((o) => setOrdersToCheck(o.filter((x) => ['pending_approval', 'awaiting_cash'].includes(x.status)).length)).catch(() => {});
    if (isFinanceAdmin(me)) { /* balances loaded above */ } else if (isLpExec(me)) financeApi.listTransactions().then((x) => setMissing(x.filter((t) => t.kind === 'cash_out' && !t.fatora_path && t.status !== 'void').length)).catch(() => {});
  }, [me, teams]);

  const card = (href: string, label: string, value: React.ReactNode, note?: React.ReactNode, icon = <ClipboardCheck size={18} aria-hidden="true" />) => (
    <Link href={href} className="tx-card tx-kpi no-underline hover:bg-surface-2">
      <span className="tx-label flex items-center gap-s1">{icon}{label}</span>
      <span className="stat tx-num">{value}</span>
      {note && <span className="caption tx-faint">{note}</span>}
    </Link>
  );
  const money = <Wallet size={18} aria-hidden="true" />;

  return (
    <>
      {toApprove !== null && card('/portal/finance', 'Requests to approve', toApprove, me.role === 'chairman' ? 'Includes those over EGP 5,000' : 'From L&P', money)}
      {left !== null && card('/portal/finance', 'Budget left', <span style={{ fontSize: 32 }}>{egp(left)}</span>, 'Division, this season', money)}
      {total !== null && card('/portal/finance', 'All accounts', <span style={{ fontSize: 32 }}>{egp(total)}</span>, `${missing ?? 0} cash outs missing a fatora`, money)}
      {total === null && missing !== null && card('/portal/finance', 'Missing fatoras', missing, 'Upload them in Cash out', money)}
      {applicants !== null && applicants > 0 && card('/portal/recruitment', 'Applicants to review', applicants, me.role === 'executive' ? 'For your team' : 'Applied or screened', <UserSearch size={18} aria-hidden="true" />)}
      {ordersToCheck !== null && ordersToCheck > 0 && card('/portal/packages', 'Sign-ups to check', ordersToCheck, 'Transfers and cash payments', <Package size={18} aria-hidden="true" />)}
    </>
  );
}
