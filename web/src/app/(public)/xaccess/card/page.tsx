'use client';
// The holder's X Access card (FR-18.1), from their private link:
// /xaccess/card/?c=<code>. No sign-in needed.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { EmptyState } from '@/components/ui';
import { CardPair, CardState, ShowCard } from '@/components/XAccess';
import { xaccessApi } from '@/lib/api/xaccess';
import { PageLoading, useLoad } from '@/lib/useLoad';

function CardInner() {
  const code = useSearchParams().get('c') ?? '';
  const card = useLoad(() => xaccessApi.getCard(code).then((c) => c ?? false), [code]);
  const [show, setShow] = useState(false);
  if (card === undefined) return <PageLoading />;
  if (!card) return <div className="mx-auto max-w-[720px] px-s4 pt-s8"><EmptyState title="We can’t find this card." action={<Link href="/perks" className="tx-btn tx-btn--secondary">See the perks</Link>}>Check the link you were sent.</EmptyState></div>;
  return (
    <div className="mx-auto max-w-[820px] px-s4 md:px-s6 pt-s7 grid gap-s5">
      <div className="grid gap-s2">
        <span className="tx-label">X Access</span>
        <h1 className="h1 uppercase">Your card</h1>
        <CardState status={card.status} />
      </div>
      <CardPair card={card} code={code} onShow={card.status === 'valid' ? () => setShow(true) : undefined} />
      <p className="text-ink-2">Keep this page; it’s your card. At a partner place, tap <b>Show my card</b> and let them scan the QR. <Link href="/perks" className="tx-link">See every perk</Link>.</p>
      {show && <ShowCard card={card} code={code} onClose={() => setShow(false)} />}
    </div>
  );
}

export default function XAccessCardPage() {
  return <Suspense><CardInner /></Suspense>;
}
