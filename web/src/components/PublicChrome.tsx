'use client';
import { CalendarDays, Home, Handshake, Info, LogIn, Menu, Mic, Sparkles, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { INSTAGRAM_URL, LICENSE_LINE } from '@/lib/env';
import { Lockup } from './Brand';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: Sparkles },
  { href: '/speakers', label: 'Speakers', icon: Mic },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/partners', label: 'Partners', icon: Handshake },
  { href: '/about', label: 'About', icon: Info },
  { href: '/join', label: 'Join the team', icon: UserPlus },
];

export function PublicHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isOn = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <header className="tx-top" style={{ height: 64 }}>
      <Link href="/" aria-label="TEDxGUC home" className="py-s3"><Lockup height={22} /></Link>
      <nav className="hidden xl:flex items-center gap-s1" aria-label="Main">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={isOn(l.href) ? 'page' : undefined}
            className={`px-s3 py-s2 text-body-sm font-semibold no-underline whitespace-nowrap ${isOn(l.href) ? 'text-ink shadow-[inset_0_-2px_0_var(--accent)]' : 'text-ink-2 hover:text-ink'}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-s1">
        <ThemeToggle />
        {/* Team portal is always one tap away for members, on every screen size. */}
        <Link href="/login" className="tx-btn tx-btn--secondary tx-btn--sm" style={{ padding: '0 12px' }}>
          <LogIn aria-hidden="true" style={{ width: 18, height: 18 }} />Portal
        </Link>
        <Link href="/events" className="tx-btn tx-btn--primary tx-btn--sm hidden md:inline-flex">Get your ticket</Link>
        <button className="tx-iconbtn xl:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="xl:hidden fixed inset-x-0 top-[64px] bottom-0 z-nav bg-bg tx-page overflow-y-auto" aria-label="Main">
          <ul className="grid">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center gap-s3 px-s4 py-s4 border-b border-line no-underline">
                  <l.icon size={22} className={isOn(l.href) ? 'text-accent' : 'text-ink-3'} />
                  <span className="h3 uppercase">{l.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="p-s4 grid gap-s3">
            <Link href="/events" className="tx-btn tx-btn--primary tx-btn--block">Get your ticket</Link>
            <Link href="/login" className="tx-btn tx-btn--secondary tx-btn--block">Team portal</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-s8 border-t border-line">
      <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 py-s7 grid gap-s6 md:grid-cols-[1.4fr_1fr_minmax(0,1fr)]">
        <div className="grid gap-s3 content-start">
          <Lockup height={24} />
          <p className="text-ink-2 text-body-sm max-w-[340px]">Ideas worth spreading at the German University in Cairo, since 2013.</p>
        </div>
        <ul className="grid gap-s2 content-start text-body-sm" aria-label="Site">
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/">Home</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/events">Events</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/speakers">Speakers</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/calendar">Calendar</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/contact">Contact &amp; FAQ</Link></li>
        </ul>
        <ul className="grid gap-s2 content-start text-body-sm" aria-label="More">
          <li><a className="text-ink-2 hover:text-ink no-underline" href={INSTAGRAM_URL} rel="noopener noreferrer" target="_blank">Instagram @tedxguc__</a></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/partners#become-a-partner">Become a partner</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/join">Join the team</Link></li>
          <li><Link className="text-ink-2 hover:text-ink no-underline" href="/login">Team portal</Link></li>
        </ul>
      </div>
      <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pb-s5">
        <p className="tx-legal">{LICENSE_LINE}</p>
      </div>
      <div className="tx-bottombar" />
    </footer>
  );
}
