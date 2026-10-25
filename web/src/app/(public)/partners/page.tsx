/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { InquiryForm } from '@/components/InquiryForm';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Partners' };
export const revalidate = 300;

const TIERS = ['Main', 'Gold', 'Silver', 'Community'];

export default async function PartnersPage() {
  const partners = await api.listPartners();
  const tiers = [...TIERS, ...new Set(partners.map((p) => p.tier ?? 'Partners').filter((t) => !TIERS.includes(t)))];
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Partners" count={partners.length} title="Partners" />
      {tiers.map((tier) => {
        const list = partners.filter((p) => (p.tier ?? 'Partners') === tier);
        if (!list.length) return null;
        return (
          <section key={tier} className="grid gap-s4" aria-labelledby={`t-${tier}`}>
            <SectionHeading as="h3"><span id={`t-${tier}`}>{tier === 'Main' ? 'Main partners' : `${tier} partners`}</span></SectionHeading>
            <ul className={`grid gap-s2 ${tier === 'Main' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
              {list.map((p) => {
                const inner = p.logo_url
                  ? <img src={p.logo_url} alt={p.company} className="max-h-[56px] max-w-[70%] object-contain" />
                  : <span className="font-bold">{p.company}</span>;
                return (
                  <li key={p.id} className={`tx-card grid place-items-center text-center ${tier === 'Main' ? 'min-h-[140px]' : 'min-h-[96px]'}`}>
                    {p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="no-underline">{inner}</a> : inner}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <section id="become-a-partner" className="grid gap-s4 md:grid-cols-[minmax(0,1fr)_1.4fr] md:items-start scroll-mt-[88px]" aria-labelledby="bp">
        <div className="grid gap-s3">
          <SectionHeading as="h3"><span id="bp">Become a partner</span></SectionHeading>
          <p className="text-ink-2">Put your brand in front of our guests and community: on stage, in the hall and online.</p>
          <ul className="tx-stars body">
            <li>Logo placements on stage, screens and the site</li>
            <li>Booths on event day</li>
            <li>Perks for our X Access card holders</li>
          </ul>
        </div>
        <InquiryForm kind="partner" />
      </section>
    </div>
  );
}
