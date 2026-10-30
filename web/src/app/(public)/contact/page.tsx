'use client';
import { Instagram } from 'lucide-react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { InquiryForm } from '@/components/InquiryForm';
import { FaqList } from '@/components/SiteSections';
import { api } from '@/lib/api';
import { PageLoading } from '@/lib/useLoad';
import { usePublicData } from '@/lib/usePublicData';
import { DataNotice } from '@/components/public/DataNotice';
import { INSTAGRAM_URL } from '@/lib/env';


export default function ContactPage() {
  const { data: d, error, loading, reload } = usePublicData(async () => {
    const { faq } = await api.getSections(['faq']);
    return { faq };
  });
  if (!d && error) return <div className="public-container pt-s7"><DataNotice message={error} retry={reload} loading={loading} /></div>;
  if (!d) return <PageLoading />;
  const { faq } = d;
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Contact" title="Talk to us" />
      <div className="grid gap-s7 lg:grid-cols-2 lg:items-start">
        <section className="grid gap-s4" aria-labelledby="faq">
          <SectionHeading as="h3"><span id="faq">FAQ</span></SectionHeading>
          <FaqList initial={faq} />
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--secondary justify-self-start">
            <Instagram aria-hidden="true" />@tedxguc__
          </a>
        </section>
        <section className="grid gap-s4" aria-labelledby="msg">
          <SectionHeading as="h3"><span id="msg">Send a message</span></SectionHeading>
          <InquiryForm kind="contact" />
        </section>
      </div>
    </div>
  );
}
