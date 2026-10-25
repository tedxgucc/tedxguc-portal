'use client';
// Expense requests (FR-12.7, FR-12.10).
// Only L&P Executives ask for money. The Operations Curator (or the
// Chairman) approves; anything over the limit also goes to the Chairman.
// Nobody else sees these requests.
import { Check, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { financeApi } from '@/lib/api/phase2';
import { fmtShortDate } from '@/lib/format';
import { canRequestMoney, isFinanceAdmin, isLpExec } from '@/lib/roles';
import type { BudgetStatus, ExpenseRequest, TxEvent } from '@/lib/types';
import { Money, RequestChip } from '../FinanceBits';

export function RequestsTab() {
  const { me, team, memberName, teams, divisions } = usePortal();
  const toast = useToast();
  const [list, setList] = useState<ExpenseRequest[] | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [rejecting, setRejecting] = useState<ExpenseRequest | null>(null);

  const load = useCallback(() => {
    financeApi.listExpenseRequests().then(setList).catch(() => setList([]));
    if (me.role === 'curator' && me.division_kind === 'operations' && me.division_id) financeApi.divisionBudget(me.division_id).then(setBudget).catch(() => {});
  }, [me]);
  useEffect(() => { load(); }, [load]);

  const divisionOf = (teamId: string) => teams.find((t) => t.id === teamId)?.division_id;
  void divisionOf;
  const toDecide = (list ?? []).filter((r) => (r.status === 'submitted' && isFinanceAdmin(me))
    || (r.status === 'awaiting_chairman' && me.role === 'chairman'));
  const mine = (list ?? []).filter((r) => r.requested_by === me.id);
  const toBuy = isLpExec(me) || isFinanceAdmin(me) ? (list ?? []).filter((r) => r.status === 'approved') : [];
  const others = isFinanceAdmin(me) ? (list ?? []).filter((r) => !toDecide.includes(r) && r.requested_by !== me.id) : [];

  const decide = async (r: ExpenseRequest, approve: boolean, reason?: string) => {
    try {
      const res = await financeApi.decideExpenseRequest(r.id, approve, reason);
      toast('ok', res.status === 'awaiting_chairman' ? 'Approved, sent to the chairman.' : approve ? 'Approved.' : 'Rejected.',
        res.status === 'awaiting_chairman' ? 'Over EGP 5,000 also needs the chairman.' : approve ? 'L&P can buy it now.' : undefined);
      setRejecting(null);
      load();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };

  const row = (r: ExpenseRequest, actions?: React.ReactNode) => (
    <li key={r.id} className="tx-card grid gap-s2">
      <div className="flex flex-wrap items-start justify-between gap-s2">
        <div className="grid min-w-0">
          <span className="font-semibold">{r.item}</span>
          <span className="text-caption text-ink-3">{team(r.team_id)?.name} · {memberName(r.requested_by)} · {fmtShortDate(r.created_at)}</span>
        </div>
        <span className="money"><Money value={r.amount_egp} /></span>
      </div>
      {r.reason && <p className="text-body-sm text-ink-2">{r.reason}</p>}
      {r.reject_reason && <p className="text-body-sm text-bad">“{r.reject_reason}”</p>}
      <div className="flex flex-wrap items-center justify-between gap-s2"><RequestChip status={r.status} />{actions}</div>
    </li>
  );

  return (
    <div className="grid gap-s6">
      {canRequestMoney(me) && <div className="flex flex-wrap gap-s2"><Button onClick={() => setAsking(true)}><Plus aria-hidden="true" />Request money</Button></div>}

      {budget && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-s2" aria-label="Division budget">
          <div className="tx-card tx-kpi"><span className="tx-label">Budget</span><span className="money"><Money value={budget.budget ?? 0} /></span>{budget.budget === null && <span className="caption tx-faint">Not set yet</span>}</div>
          <div className="tx-card tx-kpi"><span className="tx-label">Spent</span><span className="money"><Money value={budget.spent} /></span></div>
          <div className="tx-card tx-kpi"><span className="tx-label">Approved, not bought</span><span className="money"><Money value={budget.approved_not_bought} /></span></div>
          <div className="tx-card tx-kpi"><span className="tx-label">Left</span><span className={`money ${budget.remaining !== null && budget.remaining < 0 ? 'text-bad' : ''}`}><Money value={budget.remaining ?? 0} /></span></div>
        </section>
      )}

      {list === null && <Skeleton h={200} />}

      {toDecide.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="decide">
          <SectionHeading as="h3"><span id="decide">Waiting for you ({toDecide.length})</span></SectionHeading>
          <ul className="grid gap-s2">{toDecide.map((r) => row(r, (
            <div className="flex gap-s2">
              <Button small variant="secondary" onClick={() => setRejecting(r)}><X aria-hidden="true" />Reject</Button>
              <Button small onClick={() => decide(r, true)}><Check aria-hidden="true" />Approve</Button>
            </div>
          )))}</ul>
        </section>
      )}

      {toBuy.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="buy">
          <SectionHeading as="h3"><span id="buy">Approved, ready to buy ({toBuy.length})</span></SectionHeading>
          <p className="text-body-sm text-ink-3 -mt-s2">Record the purchase in Cash out and pick the request; it’s marked bought automatically.</p>
          <ul className="grid gap-s2">{toBuy.map((r) => row(r))}</ul>
        </section>
      )}

      {list && (
        <section className="grid gap-s3" aria-labelledby="mine">
          <SectionHeading as="h3"><span id="mine">My requests</span></SectionHeading>
          {mine.length ? <ul className="grid gap-s2">{mine.map((r) => row(r, ['submitted', 'awaiting_chairman'].includes(r.status)
            ? <Button small variant="ghost" onClick={async () => { await financeApi.cancelExpenseRequest(r.id).catch((e) => toast('bad', 'That didn’t cancel.', e.message)); load(); }}>Cancel</Button> : undefined))}</ul>
            : <EmptyState title="No money moved.">Need something for your team? Request it; your curator approves.</EmptyState>}
        </section>
      )}

      {others.length > 0 && (
        <section className="grid gap-s3" aria-labelledby="hist">
          <SectionHeading as="h3"><span id="hist">{me.role === 'chairman' ? 'All requests' : `${divisions.find((d) => d.id === me.division_id)?.name ?? 'Division'} history`}</span></SectionHeading>
          <ul className="grid gap-s2">{others.slice(0, 20).map((r) => row(r))}</ul>
        </section>
      )}

      <AskModal open={asking} onClose={() => setAsking(false)} onSent={() => { setAsking(false); toast('ok', 'Request sent.', 'Your curator will approve or reject it.'); load(); }} />
      <RejectModal request={rejecting} onClose={() => setRejecting(null)} onReject={(reason) => rejecting && decide(rejecting, false, reason)} />
    </div>
  );
}

function AskModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { me, teams } = usePortal();
  // Own team only for Associates and Executives; Curators choose a team in their division.
  const options = teams.filter((t) => t.id === me.team_id);
  const [teamId, setTeamId] = useState(options[0]?.id ?? '');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) api.listEvents('upcoming').then(setEvents).catch(() => {}); }, [open]);
  const n = Number(amount);
  const send = async () => {
    if (!item.trim() || !(n > 0)) { setError('Say what it is and how much.'); return; }
    setBusy(true);
    try {
      await financeApi.createExpenseRequest({ team_id: teamId, item: item.trim(), amount_egp: n, reason: reason.trim() || undefined, event_id: eventId || null });
      setItem(''); setAmount(''); setReason(''); setError(null);
      onSent();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Request money"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} loading={busy}>Send request</Button></>}>
      <div className="grid gap-s4">
        {options.length > 1 ? (
          <Select label="For team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>{options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        ) : <p className="text-body-sm text-ink-2">For <b>{options[0]?.name}</b></p>}
        <TextInput label="What do you need?" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Camera batteries (4)" />
        <TextInput label="Amount (EGP)" type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
          help={n > 5000 ? 'Over EGP 5,000: the chairman approves too.' : 'Your curator approves.'} />
        <Select label="For an event (optional)" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">No event</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
        <TextArea label="Why (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function RejectModal({ request, onClose, onReject }: { request: ExpenseRequest | null; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={!!request} onClose={onClose} title={request ? `Reject EGP ${request.amount_egp.toLocaleString('en-US')} for ${request.item}?` : ''}
      actions={<><Button variant="secondary" onClick={onClose}>Keep it</Button><Button variant="danger" onClick={() => { onReject(reason.trim()); setReason(''); }}>Reject</Button></>}>
      <TextArea label="Tell them why (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
    </Modal>
  );
}
