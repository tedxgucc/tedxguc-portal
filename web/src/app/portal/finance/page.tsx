'use client';
// Finance (FR-12), tabs by stakeholder:
//   Everyone              → Requests: ask for money for your team, follow it (12.7, 12.10)
//   Curators / Chairman   → Requests to approve + division budget (12.7, 12.10)
//   L&P Executives        → Cash out: record, fatora, expense form + memo (12.2, 12.3)
//   Partnerships Execs    → Bank: deposits net of VAT, sponsor approvals (12.4)
//   Ops Curator, Chairman → Balances, budgets, reconciliation, full cashbook (12.5, 12.6, 12.8, 12.9, 12.11)
import { useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { BalancesTab } from '@/components/portal/finance/BalancesTab';
import { BankTab } from '@/components/portal/finance/BankTab';
import { CashOutTab } from '@/components/portal/finance/CashOutTab';
import { ReportsTab } from '@/components/portal/finance/ReportsTab';
import { RequestsTab } from '@/components/portal/finance/RequestsTab';
import { usePortal } from '@/components/portal/PortalContext';
import { Segmented } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { canRecordCashOut, canRecordDeposits, isFinanceAdmin, isLpExec, isPartnershipsExec, seesMoneyRequests } from '@/lib/roles';

type Tab = 'requests' | 'cashout' | 'bank' | 'balances' | 'reports';

export default function FinancePage() {
  const { me } = usePortal();
  const tabs: { value: Tab; label: string }[] = [];
  if (seesMoneyRequests(me)) tabs.push({ value: 'requests', label: 'Requests' });
  if (canRecordCashOut(me)) tabs.push({ value: 'cashout', label: 'Cash out' });
  if (canRecordDeposits(me)) tabs.push({ value: 'bank', label: 'Bank' });
  if (isFinanceAdmin(me)) tabs.push({ value: 'balances', label: 'Balances' }, { value: 'reports', label: 'Reports' });
  const first: Tab = isFinanceAdmin(me) ? 'balances' : isLpExec(me) ? 'cashout' : isPartnershipsExec(me) ? 'bank' : 'requests';
  const [tab, setTab] = useState<Tab>(first);
  if (!tabs.length) return <EmptyState title="Finance is for L&P, Partnerships and Operations leads">Money requests go through your L&P Executive.</EmptyState>;

  return (
    <>
      <PageTitle label={isFinanceAdmin(me) ? 'Finance · Operations' : isLpExec(me) ? 'Finance · Logistics and Planning' : isPartnershipsExec(me) ? 'Finance · Partnerships' : 'Finance'}
        title={tab === 'requests' ? 'Expenses' : tab === 'cashout' ? 'Cash out' : tab === 'bank' ? 'Bank' : tab === 'reports' ? 'Reports' : 'Balances'} />
      {tabs.length > 1 && <div className="mb-s5 overflow-x-auto -mx-s4 px-s4 md:mx-0 md:px-0"><div className="min-w-[480px] max-w-[680px]"><Segmented label="Finance view" value={tab} onChange={setTab} options={tabs} /></div></div>}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'cashout' && <CashOutTab />}
      {tab === 'bank' && <BankTab />}
      {tab === 'balances' && <BalancesTab />}
      {tab === 'reports' && <ReportsTab />}
    </>
  );
}
