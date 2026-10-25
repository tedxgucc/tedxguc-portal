'use client';
// Sign-ups for members (Associates and the board): packages, trips and
// anything else that needs registration. Members-only, never public.
import { ArrowRight, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Skeleton } from '@/components/ui';
import { packagesApi } from '@/lib/api/phase2b';
import { egp, fmtDate } from '@/lib/format';
import { canManageSignUps } from '@/lib/roles';
import { kindLabel } from '@/lib/signups';
import type { Order, OrderStatus, Package } from '@/lib/types';

const statusText: Record<OrderStatus, [string, 'ok' | 'pending' | 'bad' | 'void' | 'soft']> = {
  pending_proof: ['Pay now', 'pending'], pending_approval: ['Checking payment', 'pending'], awaiting_cash: ['Pay at the booth', 'pending'],
  approved: ['Confirmed', 'ok'], delivered: ['Done', 'ok'], rejected: ['Payment not confirmed', 'bad'], expired: ['Expired', 'void'],
  cancelled: ['Cancelled', 'void'], refunded: ['Refunded', 'void'],
};

export default function SignUpsPage() {
  const { me } = usePortal();
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<Package[] | null>(null);
  const [mine, setMine] = useState<Order[]>([]);
  useEffect(() => {
    packagesApi.listPackages().then((l) => setList(l.filter((p) => p.is_active))).catch(() => setList([]));
    packagesApi.mySignUps().then(setMine).catch(() => {});
  }, []);
  const name = (id: string) => list?.find((p) => p.id === id)?.name ?? 'Sign-up';
  const open = async (o: Order) => {
    try { router.push(`/orders/${await packagesApi.orderLink(o.id)}`); } catch (e) { toast('bad', 'Couldn’t open it.', (e as Error).message); }
  };

  return (
    <>
      <PageTitle label="Members only" title="Sign-ups">
        {canManageSignUps(me) && <Link href="/portal/packages" className="tx-btn tx-btn--secondary tx-btn--sm"><Settings2 aria-hidden="true" />Manage</Link>}
      </PageTitle>
      {mine.length > 0 && (
        <section className="grid gap-s3 mb-s7">
          <SectionHeading>Mine</SectionHeading>
          <ul className="grid gap-s2 md:grid-cols-2">
            {mine.map((o) => (
              <li key={o.id} className="tx-card flex items-center justify-between gap-s3">
                <span className="grid min-w-0">
                  <span className="font-semibold truncate">{name(o.package_id)}</span>
                  <span className="caption tx-faint">{o.order_no} · {o.total_egp ? egp(o.total_egp) : 'Free'}</span>
                </span>
                <span className="flex items-center gap-s2 shrink-0">
                  <Chip kind={statusText[o.status][1]}>{statusText[o.status][0]}</Chip>
                  <Button small variant="ghost" onClick={() => open(o)} aria-label={`Open ${o.order_no}`}><ArrowRight size={16} /></Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-s3">
        <SectionHeading>Open now</SectionHeading>
        {list === null ? <Skeleton h={240} /> : list.length === 0 ? <EmptyState title="Nothing open right now">Packages, trips and other sign-ups show up here.</EmptyState> : (
          <ul className="grid gap-s3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const taken = mine.some((o) => o.package_id === p.id && !['cancelled', 'expired', 'rejected', 'refunded'].includes(o.status));
              return (
                <li key={p.id} className="tx-card grid gap-s3 content-start">
                  <div className="flex items-start justify-between gap-s2">
                    <span className="tx-label">{kindLabel[p.kind ?? 'package']}</span>
                    {p.stock_left === 0 ? <Chip kind="void">Full</Chip> : <Chip kind="soft">{p.stock_left} left</Chip>}
                  </div>
                  <h3 className="h3 uppercase">{p.name}</h3>
                  {p.description && <p className="text-body-sm text-ink-2">{p.description}</p>}
                  {p.contents.length > 0 && <ul className="tx-stars text-body-sm">{p.contents.map((c) => <li key={c}>{c}</li>)}</ul>}
                  <div className="flex items-end justify-between gap-s2 border-t border-line pt-s3">
                    <span className="grid"><span className="money">{p.price_egp ? egp(p.price_egp) : 'Free'}</span>{p.closes_at && <span className="caption tx-faint">Closes {fmtDate(p.closes_at)}</span>}</span>
                    {taken ? <Chip kind="ok">Signed up</Chip>
                      : <Link href={`/portal/signups/${p.id}`} className={`tx-btn tx-btn--primary tx-btn--sm ${p.stock_left === 0 ? 'pointer-events-none opacity-50' : ''}`}>Sign up</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
