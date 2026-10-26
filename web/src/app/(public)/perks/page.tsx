'use client';
// Public "X Access perks" page (FR-18.2): partner logos, each perk, terms and expiry.
import { PageTitle } from '@/components/Brand';
import { EmptyState } from '@/components/ui';
import { PerkList, XCardFront } from '@/components/XAccess';
import { xaccessApi } from '@/lib/api/xaccess';
import { PageLoading, useLoad } from '@/lib/useLoad';

export default function PerksPage() {
  const perks = useLoad(() => xaccessApi.listPerks());
  if (!perks) return <PageLoading />;
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s6">
      <div className="grid gap-s5 md:grid-cols-[minmax(0,1fr)_360px] md:items-center">
        <div className="grid gap-s3">
          <PageTitle label="X Access" title="Perks" />
          <p className="body-lg text-ink-2 -mt-s3 max-w-[560px]">Show your X Access card at these places. They scan the QR and the discount is yours.</p>
        </div>
        <XCardFront />
      </div>
      {perks.length ? <PerkList perks={perks} /> : <EmptyState title="Perks are on the way">New partner discounts show up here.</EmptyState>}
    </div>
  );
}
