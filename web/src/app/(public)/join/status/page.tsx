'use client';
// Applicant's private status page (FR-2.2, FR-4.4, FR-4.6): where the
// application stands, interview booking, withdraw. Rejections stay
// "in review" until the curator releases them for the whole round.
import { CalendarCheck, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TxLabel } from '@/components/Brand';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Skeleton } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { fmtDate, fmtTime } from '@/lib/format';
import type { ApplicationView } from '@/lib/types';

const STEPS = ['received', 'in_review', 'interview', 'decision'] as const;
const stepOf = (s: ApplicationView['stage']) => (s === 'accepted' || s === 'not_selected' ? 3 : s === 'interview' ? 2 : s === 'in_review' ? 1 : 0);
const stepLabel = ['Received', 'In review', 'Interview', 'Decision'];

function StatusInner() {
  const token = useSearchParams().get('t') ?? '';
  const isNew = useSearchParams().get('new') === '1';
  const toast = useToast();
  const [a, setA] = useState<ApplicationView | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => recruitmentApi.getApplication(token).then(setA).catch(() => setA(null)), [token]);
  useEffect(() => { load(); }, [load]);

  const book = async (slotId: string) => {
    setBusy(slotId);
    try { await recruitmentApi.bookSlot(token, slotId); toast('ok', 'Interview booked.', 'We’ll see you there.'); await load(); }
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

  const step = stepOf(a.stage);
  return (
    <div className="mx-auto max-w-[720px] px-s4 md:px-s6 pt-s7 grid gap-s6">
      <header className="grid gap-s2">
        <TxLabel>{a.cycle}</TxLabel>
        <h1 className="h1 uppercase">{a.stage === 'accepted' ? 'Welcome in' : a.stage === 'not_selected' ? 'Thank you' : a.stage === 'withdrawn' ? 'Withdrawn' : isNew ? 'Application sent' : `Hi, ${a.applicant_name.split(' ')[0]}`}</h1>
        <p className="text-ink-2">
          {a.stage === 'accepted' ? 'You’re in. Check your email to set up your portal account.'
            : a.stage === 'not_selected' ? 'We couldn’t offer you a place this round. We’d love to see you at our events and in the next round.'
            : a.stage === 'withdrawn' ? 'You withdrew this application. You can apply again while the round is open.'
            : isNew ? 'We emailed you this page’s link. Keep it: it’s how you follow your application.' : 'Here’s where your application stands.'}
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

      {a.interview && (
        <div className="tx-card grid gap-s2" style={{ boxShadow: 'inset 3px 0 0 var(--ok)' }}>
          <Chip kind="ok">Interview booked</Chip>
          <p className="h4">{fmtDate(a.interview.starts_at)} · {fmtTime(a.interview.starts_at)}</p>
          <p className="text-ink-2 flex items-center gap-s2"><MapPin size={16} aria-hidden="true" />{a.interview.location ?? 'Location by email'} · {a.interview.team}</p>
        </div>
      )}

      {a.stage === 'interview' && (
        <section className="grid gap-s3" aria-labelledby="slots">
          <h2 id="slots" className="tx-heading h3">{a.interview ? 'Need another time?' : 'Pick your interview time'}</h2>
          {a.open_slots && a.open_slots.length > 0 ? (
            <ul className="grid gap-s2">
              {a.open_slots.map((s) => (
                <li key={s.slot_id} className="tx-card flex flex-wrap items-center gap-s3" style={{ padding: '12px 16px' }}>
                  <span className="flex-1 min-w-0"><span className="font-semibold block">{fmtDate(s.starts_at)} · {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}</span><span className="text-caption text-ink-3">{s.team}{s.location ? ` · ${s.location}` : ''}</span></span>
                  <Button small onClick={() => book(s.slot_id)} loading={busy === s.slot_id}><CalendarCheck aria-hidden="true" />{a.interview ? 'Move here' : 'Book'}</Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-ink-2">No free times right now. The team adds more soon; check back or watch your email.</p>}
        </section>
      )}

      {!['accepted', 'not_selected', 'withdrawn'].includes(a.stage) && (
        <button className="tx-link text-body-sm justify-self-start bg-transparent border-0 cursor-pointer" onClick={() => setConfirm(true)}>Withdraw my application</button>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Withdraw your application?"
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)}>Keep it</Button><Button variant="danger" onClick={withdraw} loading={busy === 'withdraw'}>Withdraw</Button></>}>
        <p className="text-ink-2">Your interview, if any, is released. You can apply again while the round is open.</p>
      </Modal>
    </div>
  );
}

export default function ApplicationStatusPage() {
  return <Suspense><StatusInner /></Suspense>;
}
