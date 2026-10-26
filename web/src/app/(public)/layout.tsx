import { PublicFooter, PublicHeader } from '@/components/PublicChrome';
import { SponsorBanner } from '@/components/SponsorBanner';
import { DemoBanner } from '@/components/DemoBanner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-s2 focus:left-s2 focus:z-modal tx-btn tx-btn--secondary tx-btn--sm">Skip to content</a>
      <DemoBanner />
      <SponsorBanner />
      <PublicHeader />
      <main id="main" className="tx-page">{children}</main>
      <PublicFooter />
    </>
  );
}
