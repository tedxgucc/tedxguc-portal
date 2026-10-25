'use client';
import { useEffect } from 'react';
import { PortalMark } from '@/components/Brand';
import { DemoBannerClient } from '@/components/portal/DemoBannerClient';
import { PortalSidebar, PortalTabBar, PortalTopBar } from '@/components/portal/PortalChrome';
import { PortalProvider } from '@/components/portal/PortalContext';

function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center" aria-busy="true" aria-label="Loading the portal">
      <div className="animate-pulse"><PortalMark size={48} /></div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Offline door check-in needs the service worker (production builds only).
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return (
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
  );
}
