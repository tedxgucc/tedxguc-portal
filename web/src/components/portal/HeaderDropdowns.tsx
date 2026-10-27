'use client';

import { Bell, CreditCard, Globe, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { CardState, XCardBack, XCardFront } from '@/components/XAccess';
import { Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cairoToday, xaccessApi, type XCard } from '@/lib/api/xaccess';
import { fmtRelative } from '@/lib/format';
import { notificationPage } from '@/lib/notification-link';
import type { Notification } from '@/lib/types';
import { usePortal } from './PortalContext';

type Panel = 'notifications' | 'card';

export function HeaderDropdowns() {
  const { unread, markAllNotificationsRead } = usePortal();
  const [open, setOpen] = useState<Panel | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  const id = useId();
  const path = usePathname();
  useEffect(() => { setOpen(null); }, [path]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(null); (open === 'card' ? card : bell).current?.focus(); }
    };
    const focus = (e: FocusEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', focus);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', focus);
    };
  }, [open]);
  const toggle = (panel: Panel) => setOpen((current) => current === panel ? null : panel);
  return (
    <div ref={box} className="relative flex items-center gap-s1">
      <Link href="/" className="tx-iconbtn" aria-label="Open the website" title="Open the website"><Globe aria-hidden="true" /></Link>
      <button ref={card} type="button" className="tx-iconbtn" aria-label="My X Access card" aria-expanded={open === 'card'} aria-controls={`${id}-card`} onClick={() => toggle('card')}><CreditCard aria-hidden="true" /></button>
      <button ref={bell} type="button" className="tx-iconbtn relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open === 'notifications'} aria-controls={`${id}-notifications`} onClick={() => toggle('notifications')}>
        <Bell aria-hidden="true" />
        {unread > 0 && <span className="absolute top-[8px] right-[8px] min-w-[16px] h-[16px] px-[3px] rounded-pill bg-accent text-on-accent text-[10px] font-bold leading-[16px] text-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && <section id={`${id}-${open}`} aria-label={open === 'card' ? 'My X Access card' : 'Notifications'} className="tx-header-panel">
        <div className="flex items-center justify-between gap-s2 p-s3 border-b border-line">
          <h2 className="font-semibold">{open === 'card' ? 'My X Access card' : 'Notifications'}</h2>
          <button type="button" className="tx-iconbtn" aria-label="Close dropdown" onClick={() => { setOpen(null); (open === 'card' ? card : bell).current?.focus(); }}><X size={18} aria-hidden="true" /></button>
        </div>
        {open === 'card' ? <CardDropdown /> : <NotificationsDropdown markRead={markAllNotificationsRead} close={() => setOpen(null)} />}
      </section>}
    </div>
  );
}

function NotificationsDropdown({ markRead, close }: { markRead: () => Promise<void>; close: () => void }) {
  const [list, setList] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    (async () => {
      try {
        const [loaded, read] = await Promise.allSettled([api.listNotifications(), markRead()]);
        if (!active) return;
        if (loaded.status === 'fulfilled') {
          setList(read.status === 'fulfilled' ? loaded.value.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) : loaded.value);
        }
        if (loaded.status === 'rejected' || read.status === 'rejected') setError('Couldn’t load or mark notifications as read.');
      } catch {
        if (active) setError('Couldn’t load or mark notifications as read.');
      }
    })();
    return () => { active = false; };
  }, [markRead, attempt]);
  return <>
    {error && <div className="p-s3 text-body-sm" role="alert">{error} <button type="button" className="tx-link bg-transparent border-0 cursor-pointer" onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>}
    {list === null && !error && <div className="p-s3"><Skeleton h={120} /></div>}
    {list?.length === 0 && <p className="p-s4 text-body-sm text-ink-3">You’re all caught up. New updates will appear here.</p>}
    <ul className="grid">
      {list?.map((n) => {
        const content = <><span className={n.read_at ? 'font-medium' : 'font-semibold'}>{n.title}</span>{n.body && <span className="text-body-sm text-ink-2 break-words">{n.body}</span>}<span className="text-caption text-ink-3">{fmtRelative(n.created_at)}</span></>;
        const cls = 'grid gap-s1 px-s4 py-s3 border-b border-line no-underline';
        return <li key={n.id}>{n.link ? <Link href={notificationPage(n.link)} className={`${cls} hover:bg-surface-2`} onClick={close}>{content}</Link> : <div className={cls}>{content}</div>}</li>;
      })}
    </ul>
    <Link href="/portal/notifications" className="block p-s3 tx-link text-center text-body-sm" onClick={close}>View all notifications</Link>
  </>;
}

function CardDropdown() {
  const [card, setCard] = useState<XCard | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    xaccessApi.myCard().then((c) => { if (active) setCard(c); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  const status = card ? card.status === 'cancelled' ? 'cancelled' : card.expires_on < cairoToday() ? 'expired' : 'valid' : 'not_found';
  return <div className="grid gap-s3 p-s3">
    {error ? <p role="alert" className="text-body-sm">Couldn’t load your card. <button type="button" className="tx-link bg-transparent border-0 cursor-pointer" onClick={() => setAttempt((n) => n + 1)}>Retry</button></p>
      : card === undefined ? <Skeleton h={200} />
      : card === null ? <p className="text-body-sm text-ink-2">No card yet. Ask Partnerships to issue your X Access card.</p>
      : <>
        <CardState status={status} />
        <div><span className="tx-label">Front</span><XCardFront /></div>
        <div><span className="tx-label">Back</span><XCardBack card={{ ...card, status }} code={card.code} /></div>
      </>}
    <Link href="/portal/xaccess" className="tx-link text-body-sm">Open X Access</Link>
  </div>;
}
