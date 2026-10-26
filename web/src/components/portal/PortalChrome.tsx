'use client';
// Portal chrome (design system: AppChrome): sticky top bar with the lockup,
// notifications and avatar; a 248px sidebar on desktop; five tabs on mobile.
import {
  Bell, CalendarDays, CircleUser, CreditCard, Globe, Inbox, Settings2, ClipboardCheck, FolderOpen, LayoutDashboard, LogOut, Megaphone, Menu, Package, ScanLine, Sparkles, SquareKanban, UserSearch, Users, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lockup } from '@/components/Brand';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { canLeadOperations, canManageSignUps, canOpenInbox, canOpenSiteEditor, canRecordCashOut, canRecordDeposits, canScanTickets, roleLabel } from '@/lib/roles';
import { AccountMenu } from './AccountMenu';
import { usePortal } from './PortalContext';

type Item = { href: string; label: string; icon: typeof Bell; show?: boolean };

export function useNav() {
  const { me, doorEvents, eventsToday } = usePortal();
  // L&P Associates see the scanner only on event days.
  const door = canScanTickets(me, eventsToday.length > 0) || doorEvents.length > 0;
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Work',
      items: [
        { href: '/portal', label: 'Home', icon: LayoutDashboard },
        { href: '/portal/tasks', label: 'Tasks', icon: SquareKanban },
        { href: '/portal/calendar', label: 'Calendar', icon: CalendarDays },
        { href: '/portal/news', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      title: 'Events',
      items: [
        { href: '/portal/events', label: 'Events', icon: Sparkles, show: !!me.role },
        { href: '/portal/door', label: 'Door check-in', icon: ScanLine, show: door },
        { href: '/portal/signups', label: 'Sign-ups', icon: Package, show: !!me.role },
        { href: '/portal/packages', label: 'Manage sign-ups', icon: Settings2, show: canManageSignUps(me) },
      ],
    },
    {
      title: 'People',
      items: [
        { href: '/portal/attendance', label: me.role === 'associate' ? 'My attendance' : 'Attendance', icon: ClipboardCheck },
        { href: '/portal/team', label: me.role === 'executive' ? 'My team' : 'Team', icon: Users },
        { href: '/portal/recruitment', label: 'Recruitment', icon: UserSearch, show: me.role !== 'associate' && !!me.role },
        { href: '/portal/files', label: 'Files', icon: FolderOpen },
        { href: '/portal/profile', label: 'Profile', icon: CircleUser },
      ],
    },
    {
      title: 'Money',
      items: [{ href: '/portal/finance', label: 'Finance', icon: Wallet, show: canRecordCashOut(me) || canRecordDeposits(me) || canLeadOperations(me) }],
    },
    {
      title: 'Club',
      items: [
        { href: '/portal/xaccess', label: 'X Access', icon: CreditCard, show: !!me.role },
        { href: '/portal/inbox', label: 'Inbox', icon: Inbox, show: canOpenInbox(me) },
        { href: '/portal/site', label: 'Site text', icon: Globe, show: canOpenSiteEditor(me) },
        { href: '/portal/admin', label: 'Admin', icon: Settings2, show: me.role === 'chairman' },
      ],
    },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show !== false) })).filter((g) => g.items.length);
}

const isOn = (path: string, href: string) => (href === '/portal' ? path === '/portal' : path === href || path.startsWith(`${href}/`));

export function PortalTopBar() {
  const { me, unread } = usePortal();
  return (
    <header className="tx-top">
      <Link href="/portal" aria-label="Portal home" className="lg:hidden"><Lockup height={22} /></Link>
      <span className="hidden lg:block tx-label">{me.role ? roleLabel[me.role] : 'Alumni'}{me.team_name ? ` · ${me.team_name}` : me.division_name ? ` · ${me.division_name}` : ''}</span>
      <div className="flex items-center gap-s1">
        <Link href="/portal/notifications" className="tx-iconbtn relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && <span className="absolute top-[8px] right-[8px] min-w-[16px] h-[16px] px-[3px] rounded-pill bg-accent text-on-accent text-[10px] font-bold leading-[16px] text-center">{unread > 9 ? '9+' : unread}</span>}
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}

export function PortalSidebar() {
  const path = usePathname();
  const router = useRouter();
  const groups = useNav();
  return (
    <aside className="tx-sidebar" aria-label="Portal">
      <Link href="/portal" className="px-s4 h-[60px] flex items-center border-b border-line" aria-label="Portal home" style={{ borderLeft: 0 }}>
        <Lockup height={22} />
      </Link>
      <nav className="flex-1 py-s3 grid content-start gap-s4">
        {groups.map((g) => (
          <div key={g.title} className="grid">
            <div className="tx-label px-s4 pb-s1">{g.title}</div>
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className={isOn(path, i.href) ? 'is-on' : ''} aria-current={isOn(path, i.href) ? 'page' : undefined}>
                <i.icon aria-hidden="true" />{i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <button className="flex items-center gap-s3 px-s4 py-s4 text-ink-2 hover:text-ink border-t border-line bg-transparent cursor-pointer text-left font-sans text-body-sm"
        onClick={async () => { await api.signOut(); router.replace('/login'); }}>
        <LogOut size={20} aria-hidden="true" />Sign out
      </button>
    </aside>
  );
}

// Five tabs (design system: AppChrome). Attendance, Games and Finance tabs
// join in when their Phase 2/3 screens exist; until then "More" opens
// the full menu.
export function PortalTabBar() {
  const path = usePathname();
  const { me } = usePortal();
  // Design system (AppChrome): Home · Tasks · Attendance · Calendar, then a
  // role slot. People who handle money get Finance; everyone keeps More.
  const money = me.role === 'chairman' || me.role === 'curator' || canRecordCashOut(me) || canRecordDeposits(me);
  const tabs = [
    { href: '/portal', label: 'Home', icon: LayoutDashboard },
    { href: '/portal/tasks', label: 'Tasks', icon: SquareKanban },
    { href: '/portal/attendance', label: 'Attendance', icon: ClipboardCheck },
    money ? { href: '/portal/finance', label: 'Finance', icon: Wallet } : { href: '/portal/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/portal/more', label: 'More', icon: Menu },
  ];
  const moreOn = !tabs.slice(0, 4).some((t) => isOn(path, t.href));
  return (
    <nav className="tx-tabbar" aria-label="Portal">
      {tabs.map((t) => {
        const on = t.href === '/portal/more' ? moreOn : isOn(path, t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? 'is-on' : ''} aria-current={on ? 'page' : undefined}>
            <t.icon aria-hidden="true" />{t.label}
          </Link>
        );
      })}
    </nav>
  );
}
