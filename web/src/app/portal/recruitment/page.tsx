'use client';
// Recruitment (FR-4). Associates only; there are no board applications.
//   Executive → interview decisions, reallocations and availability
//   Curator   → pipeline for own division, interview times, roles
//   Chairman  → everything, and opens and closes rounds
import { useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { InterviewsTab } from '@/components/portal/recruitment/InterviewsTab';
import { PipelineTab } from '@/components/portal/recruitment/PipelineTab';
import { PositionsTab } from '@/components/portal/recruitment/PositionsTab';
import { RoundsTab } from '@/components/portal/recruitment/RoundsTab';
import { EmptyState, Segmented } from '@/components/ui';

type Tab = 'pipeline' | 'decisions' | 'interviews' | 'roles' | 'rounds';

export default function RecruitmentPage() {
  const { me } = usePortal();
  const lead = me.role === 'chairman' || me.role === 'curator';
  const tabs: { value: Tab; label: string }[] = [];
  if (lead) tabs.push({ value: 'pipeline', label: 'Pipeline' });
  if (me.role === 'executive') tabs.push({ value: 'decisions', label: 'Interview decisions' });
  if (lead || me.role === 'executive') tabs.push({ value: 'interviews', label: me.role === 'executive' ? 'My availability' : 'Interview times' });
  if (lead) tabs.push({ value: 'roles', label: 'Roles' });
  if (me.role === 'chairman') tabs.push({ value: 'rounds', label: 'Rounds' });
  const [tab, setTab] = useState<Tab | undefined>(tabs[0]?.value);
  if (!tabs.length) return <EmptyState title="Recruitment is for the board">Executives, Curators and the Chairman run recruitment.</EmptyState>;
  const scope = me.role === 'executive' ? me.team_name : me.role === 'curator' ? me.division_name : 'Whole club';

  return (
    <>
      <PageTitle label={`Recruitment · ${scope ?? ''}`} title={tabs.find((t) => t.value === tab)?.label ?? 'Recruitment'} />
      {tabs.length > 1 && <div className="mb-s5 overflow-x-auto -mx-s4 px-s4"><div className="min-w-[440px] max-w-[640px]"><Segmented label="Recruitment view" value={tab!} onChange={setTab} options={tabs} /></div></div>}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'decisions' && <PipelineTab decisionsOnly />}
      {tab === 'interviews' && <InterviewsTab />}
      {tab === 'roles' && <PositionsTab />}
      {tab === 'rounds' && <RoundsTab />}
    </>
  );
}
