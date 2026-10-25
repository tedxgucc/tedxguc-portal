'use client';
// Bank (FR-12.4), for Partnerships Executives and finance admins:
// deposits recorded net of 14% VAT, and sponsor approvals.
import { Check, Landmark, Plus, Stamp, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { financeApi } from '@/lib/api/phase2';
import { fmtShortDate } from '@/lib/format';
import type { PayMethod, Sponsorship, Transaction } from '@/lib/types';
import { kindLabel, methodLabel, Money } from '../FinanceBits';

const VAT = 0.14;

export function BankTab() {
  const toast = useToast();
  const [deposits, setDeposits] = useState<Transaction[] | null>(null);
  const [sponsors, setSponsors] = useState<Sponsorship[]>([]);
  const [adding, setAdding] = useState(false);
  const [addingSponsor, setAddingSponsor] = useState(false);
  const load = useCallback(() => {
    financeApi.listTransactions().then((x) => setDeposits(x.filter((t) => t.kind === 'bank_deposit' || t.kind === 'sponsorship'))).catch(() => setDeposits([]));
    financeApi.listSponsorships().then(setSponsors).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (s: Sponsorship, status: Sponsorship['status']) => {
    try { await financeApi.setSponsorshipStatus(s.id, status); toast('ok', status === 'approved' ? `${s.sponsor_name} approved.` : `${s.sponsor_name} rejected.`); load(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };
  const live = (deposits ?? []).filter((t) => t.status !== 'void');
  const net = live.reduce((a, t) => a + t.amount_net, 0);
  const vat = live.reduce((a, t) => a + t.vat_amount, 0);

  return (
    <div className="grid gap-s6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-s2">
        <div className="tx-card tx-kpi"><span className="tx-label">Deposited (net)</span><span className="money"><Money value={net} sign /></span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">VAT held</span><span className="money"><Money value={vat} /></span><span className="caption tx-faint">14% of gross</span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">Sponsors pending</span><span className="stat tx-num">{sponsors.filter((s) => s.status === 'pending').length}</span></div>
      </div>

      <section className="grid gap-s3" aria-labelledby="dep">
        <div className="flex flex-wrap items-center gap-s3">
          <SectionHeading as="h3" className="flex-1"><span id="dep">Deposits</span></SectionHeading>
          <Button onClick={() => setAdding(true)}><Landmark aria-hidden="true" />Add deposit</Button>
        </div>
        {deposits === null ? <Skeleton h={160} /> : deposits.length === 0 ? <EmptyState title="No money moved.">Deposits and sponsor payments appear here.</EmptyState> : (
          <table className="tx-table">
            <thead><tr><th>Deposit</th><th className="hidden md:table-cell">Account</th><th className="tx-amt hidden sm:table-cell">Gross</th><th className="tx-amt hidden sm:table-cell">VAT</th><th className="tx-amt">Net</th></tr></thead>
            <tbody>
              {deposits.map((t) => (
                <tr key={t.id} style={t.status === 'void' ? { opacity: 0.55 } : undefined}>
                  <td className="tx-strong">
                    {t.description ?? kindLabel[t.kind]}
                    <div className="text-caption text-ink-3 font-normal"><span className="code">{t.doc_number}</span> · {fmtShortDate(t.occurred_on)}{t.status === 'void' ? ' · VOID' : ''}<span className="md:hidden"> · {methodLabel[t.method]}</span></div>
                  </td>
                  <td className="hidden md:table-cell">{methodLabel[t.method]}</td>
                  <td className="tx-amt hidden sm:table-cell">{t.amount_gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="tx-amt hidden sm:table-cell">{t.vat_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="tx-amt pos">+ {t.amount_net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid gap-s3" aria-labelledby="sp">
        <div className="flex flex-wrap items-center gap-s3">
          <SectionHeading as="h3" className="flex-1"><span id="sp">Sponsor approvals</span></SectionHeading>
          <Button variant="secondary" onClick={() => setAddingSponsor(true)}><Plus aria-hidden="true" />Add sponsor</Button>
        </div>
        {sponsors.length === 0 ? <EmptyState title="No sponsors yet.">Add a sponsor deal to track it from pending to approved.</EmptyState> : (
          <ul className="grid gap-s2 md:grid-cols-2">
            {sponsors.map((s) => (
              <li key={s.id} className="tx-card grid gap-s2 content-start">
                <div className="flex items-start justify-between gap-s2">
                  <div className="grid"><span className="font-semibold">{s.sponsor_name}</span><span className="text-caption text-ink-3">{s.tier ?? 'No tier'} · {fmtShortDate(s.created_at)}</span></div>
                  <span className="money"><Money value={s.amount_egp} /></span>
                </div>
                {s.notes && <p className="text-body-sm text-ink-2">{s.notes}</p>}
                <div className="flex flex-wrap items-center justify-between gap-s2">
                  <Chip kind={s.status === 'approved' ? 'ok' : s.status === 'rejected' ? 'bad' : 'pending'}>{s.status === 'approved' ? 'Approved' : s.status === 'rejected' ? 'Rejected' : 'Pending'}</Chip>
                  {s.contract_path ? <span className="tx-chip tx-chip--soft"><Stamp aria-hidden="true" />Contract</span> : <span className="text-caption text-ink-3">No contract yet</span>}
                </div>
                {s.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-s2">
                    <Button small variant="secondary" onClick={() => setStatus(s, 'rejected')}><X aria-hidden="true" />Reject</Button>
                    <Button small onClick={() => setStatus(s, 'approved')}><Check aria-hidden="true" />Approve</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DepositModal open={adding} sponsors={sponsors} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      <SponsorModal open={addingSponsor} onClose={() => setAddingSponsor(false)} onSaved={() => { setAddingSponsor(false); load(); }} />
    </div>
  );
}

function DepositModal({ open, sponsors, onClose, onSaved }: { open: boolean; sponsors: Sponsorship[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [gross, setGross] = useState('');
  const [method, setMethod] = useState<PayMethod>('bank');
  const [vatApplies, setVatApplies] = useState(true);
  const [sponsorId, setSponsorId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number(gross) || 0;
  const vat = vatApplies ? Math.round((n * VAT / (1 + VAT)) * 100) / 100 : 0;
  const save = async () => {
    if (!(n > 0)) { setError('Enter the amount that arrived.'); return; }
    setBusy(true);
    try {
      const sp = sponsors.find((s) => s.id === sponsorId);
      const t = await financeApi.createTransaction({
        kind: sp ? 'sponsorship' : 'bank_deposit', method, amount_gross: n, vat_applies: vatApplies,
        description: description.trim() || (sp ? `${sp.sponsor_name} sponsorship` : undefined), sponsorship_id: sponsorId || null, occurred_on: date,
      });
      toast('ok', `${t.doc_number} recorded.`, `Net EGP ${t.amount_net.toLocaleString('en-US', { minimumFractionDigits: 2 })} added to ${methodLabel[method]}.`);
      setGross(''); setDescription(''); setSponsorId(''); setError(null);
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add a deposit"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Amount received, with VAT (EGP)" type="number" inputMode="decimal" min={1} value={gross} onChange={(e) => setGross(e.target.value)} />
        <Check2 label="Includes 14% VAT" checked={vatApplies} onChange={(e) => setVatApplies(e.target.checked)} />
        <div className="tx-card tx-card--outline grid grid-cols-3 gap-s2 text-center" aria-live="polite">
          <div><div className="tx-label">Gross</div><div className="font-semibold tabular-nums">{n.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
          <div><div className="tx-label">VAT</div><div className="font-semibold tabular-nums">{vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
          <div><div className="tx-label">Net</div><div className="font-semibold tabular-nums text-ok">{(n - vat).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
        </div>
        <div className="grid gap-s4 sm:grid-cols-2">
          <Select label="Into" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            <option value="bank">Bank account</option><option value="instapay">InstaPay (bank)</option><option value="telda">Telda</option><option value="cash">Cash</option>
          </Select>
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {sponsors.filter((s) => s.status === 'approved').length > 0 && (
          <Select label="From a sponsor? (optional)" value={sponsorId} onChange={(e) => setSponsorId(e.target.value)}>
            <option value="">Not a sponsor payment</option>
            {sponsors.filter((s) => s.status === 'approved').map((s) => <option key={s.id} value={s.id}>{s.sponsor_name}</option>)}
          </Select>
        )}
        <TextInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Booth rental, Cairo Coffee Co." />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function SponsorModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState('Gold');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!name.trim() || !(Number(amount) > 0)) { setError('Add the sponsor and the deal amount.'); return; }
    setBusy(true);
    try { await financeApi.createSponsorship({ sponsor_name: name.trim(), tier, amount_egp: Number(amount), notes: notes.trim() || undefined }); setName(''); setAmount(''); setNotes(''); setError(null); onSaved(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add a sponsor deal"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Sponsor" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-s4 sm:grid-cols-2">
          <Select label="Tier" value={tier} onChange={(e) => setTier(e.target.value)}>{['Main', 'Gold', 'Silver', 'Community'].map((t) => <option key={t}>{t}</option>)}</Select>
          <TextInput label="Deal amount (EGP)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
