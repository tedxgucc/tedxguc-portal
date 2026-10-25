'use client';
// Cash out (FR-12.2, FR-12.3, FR-12.8), for L&P Executives and finance admins.
// Every entry gets a number (CO-2027-0001), a fatora (flagged if missing),
// and one-tap paperwork: the numbered expense form and memo PDFs.
import { Ban, FileText, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { financeApi } from '@/lib/api/phase2';
import { fmtShortDate } from '@/lib/format';
import type { ExpenseRequest, PayMethod, Transaction, TxEvent } from '@/lib/types';
import { FatoraChip, FatoraUpload, Money, PaperworkLinks, UploadArea } from '../FinanceBits';

export function CashOutTab() {
  const { team } = usePortal();
  const toast = useToast();
  const [list, setList] = useState<Transaction[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  const [adding, setAdding] = useState(false);
  const [docs, setDocs] = useState<Record<string, { expense_form_url: string | null; memo_url: string | null }>>({});
  const [voiding, setVoiding] = useState<Transaction | null>(null);

  const load = useCallback(() => financeApi.listTransactions().then((x) => setList(x.filter((t) => t.kind === 'cash_out'))).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  const paperwork = async (t: Transaction) => {
    try {
      const urls = await financeApi.makePaperwork(t.id);
      setDocs((d) => ({ ...d, [t.id]: urls }));
      toast('ok', 'Paperwork ready.', `Expense form and memo for ${t.doc_number}. Print and sign.`);
      load();
    } catch (e) { toast('bad', 'Couldn’t make the paperwork.', (e as Error).message); }
  };

  const shown = (list ?? []).filter((t) => filter === 'all' || (!t.fatora_path && t.status !== 'void'));
  const missing = (list ?? []).filter((t) => !t.fatora_path && t.status !== 'void').length;
  const total = (list ?? []).filter((t) => t.status !== 'void').reduce((a, t) => a + t.amount_net, 0);

  return (
    <div className="grid gap-s5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-s2">
        <div className="tx-card tx-kpi"><span className="tx-label">Cash out this season</span><span className="money"><Money value={-total} /></span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">Missing fatora</span><span className={`stat tx-num ${missing ? 'text-bad' : ''}`}>{missing}</span><span className="caption tx-faint">{missing ? 'Upload them before the month closes' : 'All receipts in'}</span></div>
      </div>
      <div className="flex flex-wrap items-center gap-s3">
        <Button onClick={() => setAdding(true)}><Plus aria-hidden="true" />Record cash out</Button>
        <div className="w-[260px]"><Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'missing', label: `No fatora ${missing}` }]} /></div>
      </div>

      {list === null ? <Skeleton h={240} /> : shown.length === 0 ? <EmptyState title="No money moved.">Cash outs and their fatoras appear here.</EmptyState> : (
        <ul className="grid gap-s2">
          {shown.map((t) => (
            <li key={t.id} className="tx-card grid gap-s3" style={t.status === 'void' ? { opacity: 0.6 } : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-s2">
                <div className="grid min-w-0">
                  <span className="code text-ink-3">{t.doc_number}</span>
                  <span className="font-semibold">{t.item ?? 'Cash out'}</span>
                  <span className="text-caption text-ink-3">{t.supplier ?? 'No supplier'} · {team(t.team_id)?.name ?? 'No team'} · {fmtShortDate(t.occurred_on)}</span>
                </div>
                <span className="money"><Money value={-t.amount_net} /></span>
              </div>
              <div className="flex flex-wrap items-center gap-s2">
                {t.status === 'void' ? <Chip kind="void">Void · {t.void_reason}</Chip> : <FatoraChip t={t} />}
                {t.expense_request_id && <span className="tx-chip tx-chip--soft">From a request</span>}
                {t.expense_form_path && <span className="tx-chip tx-chip--soft">Paperwork made</span>}
              </div>
              {t.status !== 'void' && (
                <div className="flex flex-wrap gap-s2">
                  {!t.fatora_path && <FatoraUpload onFile={async (f) => { await financeApi.attachFatora(t.id, f); load(); }} />}
                  <Button small variant="secondary" onClick={() => paperwork(t)}><FileText aria-hidden="true" />{t.expense_form_path ? 'Make again' : 'Expense form + memo'}</Button>
                  <Button small variant="ghost" onClick={() => setVoiding(t)}><Ban aria-hidden="true" />Void</Button>
                </div>
              )}
              {docs[t.id] && <PaperworkLinks urls={docs[t.id]} />}
            </li>
          ))}
        </ul>
      )}

      <NewCashOut open={adding} onClose={() => setAdding(false)} onSaved={(t, urls) => { setAdding(false); if (urls) setDocs((d) => ({ ...d, [t.id]: urls })); load(); }} />
      <VoidModal txn={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); load(); }} />
    </div>
  );
}

function NewCashOut({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (t: Transaction, urls?: { expense_form_url: string | null; memo_url: string | null }) => void }) {
  const { teams, team } = usePortal();
  const toast = useToast();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [requestId, setRequestId] = useState('');
  const [item, setItem] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [teamId, setTeamId] = useState('');
  const [eventId, setEventId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [fatora, setFatora] = useState<File | null>(null);
  const [makeDocs, setMakeDocs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    financeApi.listExpenseRequests().then((x) => setRequests(x.filter((r) => r.status === 'approved'))).catch(() => {});
    api.listEvents('all').then(setEvents).catch(() => {});
  }, [open]);

  const pick = (rid: string) => {
    setRequestId(rid);
    const r = requests.find((x) => x.id === rid);
    if (r) { setItem(r.item); setAmount(String(r.amount_egp)); setTeamId(r.team_id); setEventId(r.event_id ?? ''); }
  };

  const save = async () => {
    const n = Number(amount);
    if (!item.trim() || !(n > 0)) { setError('Add what was bought and the amount.'); return; }
    setBusy(true);
    try {
      const t = await financeApi.createTransaction({
        kind: 'cash_out', method, amount_gross: n, item: item.trim(), supplier: supplier.trim() || undefined,
        description: notes.trim() || undefined, team_id: teamId || null, event_id: eventId || null,
        expense_request_id: requestId || null, occurred_on: date,
      });
      if (fatora) await financeApi.attachFatora(t.id, fatora);
      let urls;
      if (makeDocs) urls = await financeApi.makePaperwork(t.id).catch(() => undefined);
      toast('ok', `${t.doc_number} recorded.`, fatora ? (urls ? 'Fatora attached; expense form and memo ready.' : 'Fatora attached.') : 'No fatora yet: it’s flagged until you add one.');
      setRequestId(''); setItem(''); setSupplier(''); setAmount(''); setNotes(''); setFatora(null); setError(null);
      onSaved({ ...t, fatora_path: fatora ? 'uploaded' : null }, urls);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record cash out"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        {requests.length > 0 && (
          <Select label="Bought for an approved request? (optional)" value={requestId} onChange={(e) => pick(e.target.value)}>
            <option value="">No request</option>
            {requests.map((r) => <option key={r.id} value={r.id}>{r.item} · EGP {r.amount_egp.toLocaleString('en-US')} · {team(r.team_id)?.name}</option>)}
          </Select>
        )}
        <TextInput label="Item" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Water bottles (500)" />
        <div className="grid gap-s4 sm:grid-cols-2">
          <TextInput label="Amount (EGP)" type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextInput label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <Select label="Paid by" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            <option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="instapay">InstaPay</option><option value="telda">Telda</option>
          </Select>
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">No team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">No event</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </Select>
        </div>
        <UploadArea file={fatora} onPick={setFatora} />
        <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <label className="tx-check"><input type="checkbox" checked={makeDocs} onChange={(e) => setMakeDocs(e.target.checked)} /><span>Make the expense form and memo now</span></label>
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export function VoidModal({ txn, onClose, onDone }: { txn: Transaction | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!txn || !reason.trim()) return;
    setBusy(true);
    try { await financeApi.voidTransaction(txn.id, reason.trim()); toast('ok', `${txn.doc_number} voided.`, 'It stays in the cashbook and the audit log.'); setReason(''); onDone(); }
    catch (e) { toast('bad', 'That didn’t void.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!txn} onClose={onClose} title={txn ? `Void ${txn.doc_number} (EGP ${txn.amount_gross.toLocaleString('en-US')})?` : ''}
      actions={<><Button variant="secondary" onClick={onClose}>Keep it</Button><Button variant="danger" onClick={go} loading={busy} disabled={!reason.trim()}>Void</Button></>}>
      <p className="text-ink-2 mb-s3">Money is never deleted. A voided entry stays visible, is left out of balances, and the reason is kept.</p>
      <TextInput label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" />
    </Modal>
  );
}
