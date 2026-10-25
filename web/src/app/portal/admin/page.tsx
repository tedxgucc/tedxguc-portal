'use client';
// Chairman admin (FR-3, FR-14): settings, structure, season rollover,
// role changes and the audit log. Other roles are sent home.
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { AuditTab, RoleChangesTab } from '@/components/portal/admin/PeopleTabs';
import { SettingsTab } from '@/components/portal/admin/SettingsTab';
import { RolloverTab, StructureTab } from '@/components/portal/admin/StructureTab';
import { usePortal } from '@/components/portal/PortalContext';
import { EmptyState, Segmented } from '@/components/ui';

type Tab = 'settings' | 'structure' | 'rollover' | 'roles' | 'audit';
const tabs: { value: Tab; label: string }[] = [
  { value: 'roles', label: 'Role changes' },
  { value: 'settings', label: 'Settings' },
  { value: 'structure', label: 'Teams' },
  { value: 'rollover', label: 'Seasons' },
  { value: 'audit', label: 'Audit log' },
];
const titles: Record<Tab, string> = { settings: 'Settings', structure: 'Divisions & teams', rollover: 'Seasons', roles: 'Role changes', audit: 'Audit log' };

export default function AdminPage() {
  const { me } = usePortal();
  const [tab, setTab] = useState<Tab>('roles');
  if (me.role !== 'chairman') {
    return <EmptyState title="Chairman only" action={<Link className="tx-btn tx-btn--secondary" href="/portal">Back to home</Link>}>Settings, seasons and role decisions belong to the Chairman.</EmptyState>;
  }
  return (
    <>
      <PageTitle label="Admin · Chairman" title={titles[tab]} />
      <div className="mb-s5 overflow-x-auto -mx-s4 px-s4 md:mx-0 md:px-0"><div className="min-w-[560px] max-w-[760px]"><Segmented label="Admin area" value={tab} onChange={setTab} options={tabs} /></div></div>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'structure' && <StructureTab />}
      {tab === 'rollover' && <RolloverTab />}
      {tab === 'roles' && <RoleChangesTab />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}
