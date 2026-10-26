'use client';
import { Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { BASE_PATH } from '@/lib/env';
import { fmtDate, fmtTime } from '@/lib/format';
import type { ApplicationView } from '@/lib/types';

export function InterviewInvitation({ application }: { application: ApplicationView }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interview = application.interview;
  if (!interview) return null;
  const reference = application.application_id.slice(0, 8).toUpperCase();
  const download = async () => {
    if (!ref.current) return;
    setBusy(true); setError(null);
    try {
      const { downloadTicketPng } = await import('@/lib/download-ticket');
      await downloadTicketPng(ref.current, `TEDxGUC-interview-${reference}`, { requireQr: false });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="grid gap-s3" aria-label="Your interview invitation">
    <div ref={ref} style={{ background: '#fff', color: '#171717', border: '1px solid #171717', overflow: 'hidden' }}>
      <div style={{ padding: '24px', borderTop: '8px solid #eb0028', borderBottom: '1px solid #dedbd8', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE_PATH}/brand/tedxguc-lockup-black.png`} alt="TEDxGUC" width={187} height={30} style={{ width: 187, height: 30, objectFit: 'contain' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700 }}>INTERVIEW CONFIRMED</span>
      </div>
      <div style={{ padding: '24px', display: 'grid', gap: 20 }}>
        <div><p style={{ fontSize: 12, letterSpacing: '0.12em', color: '#635f5c', textTransform: 'uppercase' }}>{application.cycle}</p><h2 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, marginTop: 8 }}>Your interview invitation</h2></div>
        <div><p style={{ fontSize: 11, letterSpacing: '0.1em', color: '#635f5c' }}>APPLICANT</p><p style={{ fontSize: 22, fontWeight: 700, overflowWrap: 'anywhere' }}>{application.applicant_name}</p></div>
        <dl style={{ display: 'grid', gap: 16 }}>
          <div><dt style={{ fontSize: 11, color: '#635f5c', letterSpacing: '0.1em' }}>TEAM</dt><dd style={{ fontWeight: 700 }}>{interview.team}</dd></div>
          <div><dt style={{ fontSize: 11, color: '#635f5c', letterSpacing: '0.1em' }}>DATE & TIME · CAIRO</dt><dd style={{ fontWeight: 700 }}>{fmtDate(interview.starts_at, { year: true })}<br />{fmtTime(interview.starts_at)} – {fmtTime(interview.ends_at)}</dd></div>
          <div><dt style={{ fontSize: 11, color: '#635f5c', letterSpacing: '0.1em' }}>LOCATION / MEETING LINK</dt><dd style={{ overflowWrap: 'anywhere' }}>{interview.location || 'The team will share the location.'}</dd></div>
        </dl>
      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px dashed #b8b2ad', fontSize: 12, color: '#635f5c' }}>REFERENCE {reference} · Keep this invitation for your interview.</div>
    </div>
    <div><Button variant="secondary" loading={busy} onClick={download}><Download size={18} aria-hidden="true" />Download invitation PNG</Button></div>
    {error && <p className="tx-help" role="alert">{error}</p>}
  </section>;
}
