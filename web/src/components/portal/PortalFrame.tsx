'use client';
import { useEffect } from 'react';
import { Lockup } from '@/components/Brand';
import { Skeleton } from '@/components/ui';
import { DemoBannerClient } from '@/components/portal/DemoBannerClient';
import { PortalSidebar, PortalTabBar, PortalTopBar } from '@/components/portal/PortalChrome';
import { PortalProvider } from '@/components/portal/PortalContext';
import { BASE_PATH } from '@/lib/env';

// Shown only on a first visit in this tab; it has the portal's own shape,
// so the page doesn't jump when it fills in.
function Loading() {
  return (
    <div className="tx-shell" aria-busy="true" aria-label="Loading the portal">
      <aside className="tx-sidebar">
        <div className="px-s4 h-[60px] flex items-center border-b border-line"><Lockup height={22} /></div>
        <div className="p-s4 grid gap-s3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={18} w={i % 3 ? '70%' : '50%'} />)}</div>
      </aside>
      <div className="min-w-0 flex flex-col min-h-dvh">
        <header className="tx-top"><span className="lg:hidden"><Lockup height={22} /></span><span /></header>
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-s4 md:px-s6 pt-s5 pb-s7 grid gap-s4 content-start">
          <Skeleton h={16} w={140} />
          <Skeleton h={44} w="55%" />
          <div className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={110} />)}</div>
          <Skeleton h={220} />
        </main>
      </div>
    </div>
  );
}

export default function PortalFrame({ children }: { children: React.ReactNode }) {
  // Offline door check-in needs the service worker (production builds only).
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {});
    }
  }, []);
  return (
    <>

    <PortalProvider fallback={<Loading />}>
      <div className="tx-shell">
        <PortalSidebar />
        <div className="min-w-0 flex flex-col min-h-dvh">
          <DemoBannerClient />
          <PortalTopBar />
          <main id="main" className="flex-1 w-full max-w-[1200px] mx-auto px-s4 md:px-s6 pt-s5 pb-s7 tx-page">{children}</main>
          <PortalTabBar />
        </div>
      </div>
    </PortalProvider>
    </>
  );
}
