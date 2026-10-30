import { PublicFooter, PublicHeader } from '@/components/PublicChrome';
import { PublicExperience } from '@/components/public/PublicExperience';
import '@/styles/public.css';
import { DemoBanner } from '@/components/DemoBanner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-s2 focus:left-s2 focus:z-modal tx-btn tx-btn--secondary tx-btn--sm">Skip to content</a>
      <PublicExperience />
      <DemoBanner />
      <PublicHeader />
      <main id="main" tabIndex={-1} className="public-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
