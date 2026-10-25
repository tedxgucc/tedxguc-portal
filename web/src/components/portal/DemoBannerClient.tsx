'use client';
import Link from 'next/link';
import { DEMO } from '@/lib/env';
import { usePortal } from './PortalContext';

export function DemoBannerClient() {
  const { me } = usePortal();
  if (!DEMO) return null;
  return (
    <div className="bg-surface-2 text-ink-2 text-caption text-center px-s4 py-s2 border-b border-line">
      Demo: you are {me.name}. <Link href="/login" className="tx-link">Switch role</Link>
    </div>
  );
}
