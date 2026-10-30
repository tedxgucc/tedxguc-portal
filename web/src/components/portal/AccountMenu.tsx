'use client';
// Account menu, top right: photo, name and role; opens a panel with the
// profile link, appearance (light / dark / auto), password and sign out.
import { ChevronRight, CircleUser, KeyRound, LogOut, Moon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/roles';
import { usePortal } from './PortalContext';

type Mode = 'light' | 'dark' | 'auto';

function applyTheme(mode: Mode) {
  const t = mode === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
  try { localStorage.setItem('tx-theme', mode); } catch { /* private mode */ }
}

export function AccountMenu() {
  const { me } = usePortal();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('dark');
  const box = useRef<HTMLDivElement>(null);
  const role = me.role ? roleLabel[me.role] : 'Alumni';
  const scope = me.team_name ?? me.division_name;

  useEffect(() => {
    try { setMode((localStorage.getItem('tx-theme') as Mode | null) ?? 'dark'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  // "Auto" follows the phone or computer setting as it changes.
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const on = () => applyTheme('auto');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mode]);

  const pick = (m: Mode) => { setMode(m); applyTheme(m); };
  const item = 'flex items-center gap-s3 px-s4 py-s3 no-underline hover:bg-surface-2 w-full text-left bg-transparent border-0 cursor-pointer font-medium';

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-s2 rounded-pill border border-line-strong bg-transparent cursor-pointer p-[3px] md:pr-s4 hover:bg-surface-1">
        <Avatar name={me.name} photo={me.photo_url} size={36} />
        <span className="hidden md:grid text-left leading-tight">
          <span className="font-semibold text-body-sm max-w-[160px] truncate">{me.name}</span>
          <span className="text-caption text-ink-3 max-w-[160px] truncate">{role}</span>
        </span>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-nav w-[320px] max-w-[calc(100vw-32px)] bg-surface-1 border border-line shadow-[var(--shadow-pop)] rounded-[var(--radius-2)] overflow-hidden">
          <div className="flex items-center gap-s3 p-s4 border-b border-line">
            <Avatar name={me.name} photo={me.photo_url} size={44} />
            <div className="grid min-w-0">
              <span className="font-semibold truncate">{me.name}</span>
              <span className="text-caption text-ink-3 truncate">{role}{scope ? ` · ${scope}` : ''}</span>
            </div>
          </div>
          <Link role="menuitem" href="/portal/profile" className={`${item} text-ink`} onClick={() => setOpen(false)}>
            <CircleUser size={18} aria-hidden="true" /><span className="flex-1">My profile</span><ChevronRight size={16} className="text-ink-3" aria-hidden="true" />
          </Link>
          <div className="grid gap-s2 px-s4 py-s3 border-y border-line">
            <span className="flex items-center gap-s3 font-medium"><Moon size={18} aria-hidden="true" />Appearance</span>
            <div className="tx-seg" role="radiogroup" aria-label="Appearance">
              {(['light', 'dark', 'auto'] as Mode[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => pick(m)} style={{ minHeight: 34 }}>
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Link role="menuitem" href="/portal/profile#password" className={`${item} text-ink`} onClick={() => setOpen(false)}>
            <KeyRound size={18} aria-hidden="true" />Change password
          </Link>
          <button role="menuitem" type="button" className={`${item}`} style={{ color: 'var(--bad)' }} onClick={async () => { await api.signOut(); router.replace('/login'); }}>
            <LogOut size={18} aria-hidden="true" />Sign out
          </button>
        </div>
      )}
    </div>
  );
}
