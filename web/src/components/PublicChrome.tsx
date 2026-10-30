'use client';
import { ArrowRight, ArrowUpRight, CalendarDays, Home, Info, Instagram, LogIn, Menu, Mic, Sparkles, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { INSTAGRAM_URL, LICENSE_LINE } from '@/lib/env';
import { Lockup } from './Brand';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: Sparkles },
  { href: '/speakers', label: 'Speakers', icon: Mic },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/about', label: 'About', icon: Info },
  { href: '/board', label: 'Board', icon: Users },
  { href: '/join', label: 'Join the team', icon: UserPlus },
];

export function PublicHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const current = path.replace(/\/+$/, '') || '/';
  const isOn = (href: string) => current === href || (href !== '/' && current.startsWith(href + '/'));
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    const desktop = window.matchMedia('(min-width: 1200px)');
    const resize = () => { if (desktop.matches) setOpen(false); };
    update(); window.addEventListener('scroll', update, { passive: true }); desktop.addEventListener('change', resize);
    return () => { window.removeEventListener('scroll', update); desktop.removeEventListener('change', resize); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLElement>('button, a')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if (e.key !== 'Tab') return;
      const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); toggle.current?.focus({ preventScroll: true }); };
  }, [open]);
  return <>
    <header className={'public-header' + (scrolled ? ' is-scrolled' : '')}>
      <Link href="/" aria-label="TEDxGUC home" className="public-header__logo"><Lockup height={24} /></Link>
      <nav className="public-desktop-nav" aria-label="Main">
        {links.filter((l) => !['/', '/join'].includes(l.href)).map((l) => <Link key={l.href} href={l.href} className="public-nav-link" aria-current={isOn(l.href) ? 'page' : undefined}>{l.label}</Link>)}
      </nav>
      <div className="public-header__actions">
        <ThemeToggle />
        <Link href="/login" className="public-portal-link"><LogIn size={16} aria-hidden="true" /><span>Portal</span></Link>
        <Link href="/events" className="tx-btn tx-btn--primary tx-btn--sm public-ticket-link">Get your ticket<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <button ref={toggle} className="tx-iconbtn public-menu-toggle" aria-label="Open menu" aria-expanded={open} aria-controls="public-menu" type="button" onClick={() => setOpen(true)}><Menu aria-hidden="true" /></button>
      </div>
    </header>
    {open && createPortal(<div id="public-menu" ref={menu} className="public-menu" role="dialog" aria-modal="true" aria-label="Site menu">
      <div className="public-menu__top"><Lockup height={22} /><button className="tx-iconbtn" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
      <nav aria-label="Main"><ul>{links.map((l, i) => <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} aria-current={isOn(l.href) ? 'page' : undefined}><span className="public-menu__number">{String(i + 1).padStart(2, '0')}</span><span>{l.label}</span><ArrowUpRight size={24} aria-hidden="true" /></Link></li>)}</ul></nav>
      <div className="public-menu__bottom"><Link href="/events" className="tx-btn tx-btn--primary" onClick={() => setOpen(false)}>Find your next event<ArrowRight aria-hidden="true" /></Link><Link href="/contact" className="tx-link" onClick={() => setOpen(false)}>Have a question? Talk to us</Link></div>
    </div>, document.body)}
  </>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer__lead"><div><span className="tx-label">Keep the conversation going</span><h2>Good ideas<br /><span>travel further.</span></h2></div><Link href="/contact" className="public-arrow-link">Talk to us<ArrowUpRight size={32} aria-hidden="true" /></Link></div>
    <div className="public-footer__grid">
      <div className="grid gap-s4 content-start"><Lockup height={24} /><p className="text-ink-2 text-body-sm max-w-[300px]">Ideas worth spreading at the German University in Cairo, since 2013.</p><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="public-social"><Instagram size={18} aria-hidden="true" />Follow the next chapter<ArrowUpRight size={16} aria-hidden="true" /></a></div>
      <nav aria-label="Explore"><h3 className="tx-label mb-s4">Explore</h3><ul className="grid gap-s3">{links.filter((l) => l.href !== '/join').map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul></nav>
      <nav aria-label="Get involved"><h3 className="tx-label mb-s4">Get involved</h3><ul className="grid gap-s3"><li><Link href="/join">Join the team</Link></li><li><Link href="/contact">Contact &amp; FAQ</Link></li><li><Link href="/login">Member portal</Link></li><li><Link href="/privacy">Privacy notice</Link></li></ul></nav>
    </div>
    <div className="public-footer__legal"><p className="tx-legal">{LICENSE_LINE}</p><span className="text-caption text-ink-3">TEDxGUC / Since 2013</span></div>
    <div className="tx-bottombar" />
  </footer>;
}
