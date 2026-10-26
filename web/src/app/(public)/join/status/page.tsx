'use client';
// Applicant's private status page (FR-2.2, FR-4.4, FR-4.6): where the
// application stands, interview booking, withdraw. Rejections stay
// "in review" until the curator releases them for the whole round.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TxLabel } from '@/components/Brand';
import { InterviewInvitation } from '@/components/InterviewInvitation';
import { InterviewSlotPicker } from '@/components/InterviewSlotPicker';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Modal, Skeleton } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { fmtDate, fmtTime } from '@/lib/format';
import type { ApplicationView, SlotView } from '@/lib/types';

const STEPS = ['application', 'slot', 'confirmed', 'decision'] as const;
const stepLabel = ['Application', 'Choose a time', 'Confirmed', 'Decision'];

function StatusInner() {
  const token = useSearchParams().get('t') ?? '';
  const isNew = useSearchParams().get('new') === '1';
  const toast = useToast();
  const [a, setA] = useState<ApplicationView | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [picked, setPicked] = useState<SlotView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => recruitmentApi.getApplication(token).then(setA).catch(() => setA(null)), [token]);
  useEffect(() => { load(); }, [load]);

  const book = async (slotId: string) => {
    setBusy(slotId);
    try { await recruitmentApi.bookSlot(token, slotId); setPicked(null); toast('ok', 'Interview confirmed.', 'Your invitation is ready to download.'); await load(); }
    catch (e) { toast('bad', 'That time didn’t work.', (e as Error).message); load(); }
    finally { setBusy(null); }
  };
  const withdraw = async () => {
    setBusy('withdraw');
    try { await recruitmentApi.withdraw(token); setConfirm(false); toast('ok', 'Application withdrawn.'); load(); }
    catch (e) { toast('bad', 'That didn’t work.', (e as Error).message); }
    finally { setBusy(null); }
  };

  if (a === undefined) return <div className="mx-auto max-w-[720px] px-s4 pt-s7"><Skeleton h={320} /></div>;
  if (a === null) return (
    <div className="mx-auto max-w-[720px] px-s4 pt-s7">
      <EmptyState title="We can’t find that application." action={<Link href="/join" className="tx-btn tx-btn--secondary">Join the team</Link>}>Check the newest email we sent you.</EmptyState>
    </div>
  );

  const canBook = a.open_slots !== null;
  const step = ['accepted', 'not_selected'].includes(a.stage) ? 3 : a.interview ? 2 : canBook ? 1 : 0;
  return (
    <div className="mx-auto max-w-[720px] px-s4 md:px-s6 pt-s7 grid gap-s6">
      <header className="grid gap-s2">
        <TxLabel>{a.cycle}</TxLabel>
        <h1 className="h1 uppercase">{a.stage === 'accepted' ? 'Welcome in' : a.stage === 'not_selected' ? 'Thank you' : a.stage === 'withdrawn' ? 'Withdrawn' : a.interview ? 'Interview confirmed' : canBook ? 'Choose your interview' : isNew ? 'Application sent' : `Hi, ${a.applicant_name.split(' ')[0]}`}</h1>
        <p className="text-ink-2">
          {a.stage === 'accepted' ? 'You’re in. Check your email to set up your portal account.'
            : a.stage === 'not_selected' ? 'We couldn’t offer you a place this round. We’d love to see you at our events and in the next round.'
            : a.stage === 'withdrawn' ? 'You withdrew this application. Only one application is allowed per recruitment round.'
            : a.interview ? 'Your time is confirmed. Save your invitation below.' : canBook ? 'Your application is saved. Choose a time for your team, then confirm your interview.' : isNew ? 'We emailed you this page’s link. Keep it: it’s how you follow your application.' : 'Here’s where your application stands.'}
        </p>
      </header>

      {a.stage !== 'withdrawn' && (
        <ol className="grid grid-cols-4 gap-s1" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="grid gap-s1" aria-current={i === step ? 'step' : undefined}>
              <span className="h-[6px]" style={{ background: i <= step ? (i === 3 && a.stage === 'not_selected' ? 'var(--void)' : 'var(--accent)') : 'var(--surface-3)' }} />
              <span className={`tx-label ${i === step ? '' : 'text-ink-3'}`} style={i === step ? { color: 'var(--ink)' } : undefined}>{stepLabel[i]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="tx-card grid gap-s2">
        <div className="tx-label">Teams</div>
        <div className="flex flex-wrap gap-s2">{a.teams.map((t, i) => <span key={t} className="tx-chip tx-chip--soft">{i + 1}. {t}</span>)}</div>
      </div>

      {a.interview && <InterviewInvitation key={a.interview.slot_id} application={a} />}

      {canBook && (
        <section className="grid gap-s3" aria-labelledby="slots">
          <h2 id="slots" className="tx-heading h3">{a.interview ? 'Need another time?' : 'Pick your interview time'}</h2>
          {a.open_slots && a.open_slots.length > 0 ? (
            <InterviewSlotPicker slots={a.open_slots} disabled={!!busy} rescheduling={!!a.interview} onChoose={setPicked} />
          ) : <div className="grid gap-s3"><p className="text-ink-2">Your application is saved, but this team has no free interview times yet. Check back here for more times.</p><div><Button small variant="secondary" onClick={load}>Refresh available times</Button></div></div>}
        </section>
      )}

      {!['accepted', 'not_selected', 'withdrawn'].includes(a.stage) && (
        <button className="tx-link text-body-sm justify-self-start bg-transparent border-0 cursor-pointer" onClick={() => setConfirm(true)}>Withdraw my application</button>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Withdraw your application?"
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)}>Keep it</Button><Button variant="danger" onClick={withdraw} loading={busy === 'withdraw'}>Withdraw</Button></>}>
        <p className="text-ink-2">Your interview, if any, is released. Withdrawing does not allow you to submit another application in this round.</p>
      </Modal>
      <Modal open={!!picked} onClose={() => { if (!busy) setPicked(null); }} title={a.interview ? 'Confirm your new interview time' : 'Confirm your interview time'}
        actions={<><Button variant="secondary" disabled={!!busy} onClick={() => setPicked(null)}>Back</Button><Button loading={!!busy} onClick={() => picked && book(picked.slot_id)}>Confirm interview</Button></>}>
        {picked && <div className="grid gap-s3"><p className="font-semibold">{picked.team}</p><p>{fmtDate(picked.starts_at, { year: true })} · {fmtTime(picked.starts_at)} – {fmtTime(picked.ends_at)} (Cairo)</p><p className="text-ink-2">{picked.location || 'The team will share the location.'}</p><p className="text-body-sm text-ink-3">Confirm to reserve this time and receive your downloadable interview invitation.</p></div>}
      </Modal>
    </div>
  );
}

export default function ApplicationStatusPage() {
  return <Suspense><StatusInner /></Suspense>;
}
