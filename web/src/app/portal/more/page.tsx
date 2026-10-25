'use client';
// Mobile "More" tab: every module this role can open.
import { ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/components/Brand';
import { useNav } from '@/components/portal/PortalChrome';
import { api } from '@/lib/api';

export default function MorePage() {
  const groups = useNav();
  const router = useRouter();
  return (
    <>
      <PageTitle label="Menu" title="More" />
      <div className="grid gap-s5">
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <div className="tx-label mb-s2">{g.title}</div>
            <ul className="grid gap-s1">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="tx-card flex items-center gap-s3 no-underline hover:bg-surface-2" style={{ padding: '14px 16px' }}>
                    <i.icon size={22} className="text-ink-2" aria-hidden="true" />
                    <span className="flex-1 font-semibold">{i.label}</span>
                    <ChevronRight size={18} className="text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button className="tx-btn tx-btn--secondary" onClick={async () => { await api.signOut(); router.replace('/login'); }}>
          <LogOut aria-hidden="true" />Sign out
        </button>
      </div>
    </>
  );
}
