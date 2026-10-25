'use client';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtRelative } from '@/lib/format';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const { refreshUnread } = usePortal();
  const [list, setList] = useState<Notification[] | null>(null);
  useEffect(() => { api.listNotifications().then(setList).catch(() => setList([])); }, []);
  const markAll = async () => {
    await api.markNotificationsRead().catch(() => {});
    setList((l) => l?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
    refreshUnread();
  };
  const unread = list?.filter((n) => !n.read_at).length ?? 0;
  return (
    <>
      <PageTitle label="Notifications" count={unread} title="Updates">
        {unread > 0 && <Button variant="secondary" onClick={markAll}><CheckCheck aria-hidden="true" />Mark all read</Button>}
      </PageTitle>
      {list === null && <Skeleton h={200} />}
      {list?.length === 0 && <EmptyState title="Nothing new.">Task assignments, mentions and announcements show up here.</EmptyState>}
      <ul className="grid gap-s1">
        {list?.map((n) => {
          const inner = (
            <>
              <Bell size={18} className={n.read_at ? 'text-ink-3' : 'text-accent'} aria-hidden="true" />
              <span className="grid grid-cols-1 min-w-0">
                <span className={n.read_at ? 'text-ink-2' : 'font-semibold'}>{n.title}</span>
                {n.body && <span className="text-body-sm text-ink-3 truncate">{n.body}</span>}
              </span>
              <span className="text-caption text-ink-3 whitespace-nowrap">{fmtRelative(n.created_at)}{!n.read_at && <span className="sr-only">, unread</span>}</span>
            </>
          );
          const cls = 'tx-card grid grid-cols-[18px_minmax(0,1fr)_auto] gap-s3 items-center no-underline';
          return <li key={n.id}>{n.link ? <Link href={n.link} className={`${cls} hover:bg-surface-2`} style={{ padding: '12px 16px' }}>{inner}</Link> : <div className={cls} style={{ padding: '12px 16px' }}>{inner}</div>}</li>;
        })}
      </ul>
    </>
  );
}
