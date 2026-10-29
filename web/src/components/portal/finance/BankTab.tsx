'use client';
// Bank (FR-12.4, FR-12.5). Finance admins (Chairman, Ops Curator) see every
// bank movement with a running balance, and record Bank in and Bank out.
// Partnerships Executives see and record deposits (net of 14% VAT when it
// applies) and approve sponsor deals.
import { ArrowDownLeft, ArrowUpRight, Check, Pencil, Plus, Stamp, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { SectionHeading } from '@/components/Brand';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { financeApi } from '@/lib/api/phase2';
import { fmtShortDate } from '@/lib/format';
import { isFinanceAdmin, isPartnershipsExec } from '@/lib/roles';
import type { PayMethod, Sponsorship, Transaction } from '@/lib/types';
import { kindLabel, methodLabel, Money } from '../FinanceBits';

const VAT = 0.14;

export function BankTab() {
  const { me } = usePortal();
  const admin = isFinanceAdmin(me);
  const toast = useToast();
  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [sponsors, setSponsors] = useState<Sponsorship[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [paying, setPaying] = useState(false);
  const [addingSponsor, setAddingSponsor] = useState(false);
  const [year, setYear] = useState('');
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all');
  const load = useCallback(() => {
    // Finance admins see the whole bank account; Partnerships see their deposits.
    financeApi.listAllTransactions()
      .then((x) => setRows(x.filter((t) => (admin ? t.account === 'bank' : t.kind === 'bank_deposit' || t.kind === 'sponsorship'))))
      .catch(() => setRows([]));
    financeApi.listSponsorships().then(setSponsors).catch(() => {});
  }, [admin]);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (sp: Sponsorship, status: Sponsorship['status']) => {
    try { await financeApi.setSponsorshipStatus(sp.id, status); toast('ok', status === 'approved' ? `${sp.sponsor_name} approved.` : `${sp.sponsor_name} rejected.`); load(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };

  // Running balance, oldest first, over entries that count.
  const withBalance = useMemo(() => {
    let bal = 0;
    return (rows ?? []).map((t) => {
      if (t.status !== 'void') bal += t.direction === 'in' ? t.amount_net : -t.amount_net;
      return { t, bal };
    });
  }, [rows]);
  const years = useMemo(() => [...new Set((rows ?? []).map((t) => t.occurred_on.slice(0, 4)))].sort().reverse(), [rows]);
  const shown = withBalance.filter(({ t }) => (!year || t.occurred_on.startsWith(year)) && (dir === 'all' || t.direction === dir)).reverse();
  const live = (rows ?? []).filter((t) => t.status !== 'void' && (!year || t.occurred_on.startsWith(year)));
  const sumIn = live.filter((t) => t.direction === 'in').reduce((x, t) => x + t.amount_net, 0);
  const sumOut = live.filter((t) => t.direction === 'out').reduce((x, t) => x + t.amount_net, 0);
  const vat = live.reduce((x, t) => x + t.vat_amount, 0);
  const balance = withBalance.at(-1)?.bal ?? 0;
  const amt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-1 gap-s6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-s2">
        {admin && <div className="tx-card tx-card--red tx-kpi col-span-2 xl:col-span-1"><span className="tx-label" style={{ color: '#fff' }}>Bank balance</span><span className="money"><Money value={balance} /></span></div>}
        <div className="tx-card tx-kpi"><span className="tx-label">In{year ? ` ${year}` : ''}</span><span className="money"><Money value={sumIn} /></span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">Out{year ? ` ${year}` : ''}</span><span className="money"><Money value={sumOut} /></span></div>
        <div className="tx-card tx-kpi"><span className="tx-label">VAT held</span><span className="money"><Money value={vat} /></span><span className="caption tx-faint">From deposits with VAT</span></div>
      </div>

      <section className="grid gap-s3" aria-labelledby="dep">
        <div className="flex flex-wrap items-center gap-s2">
          <SectionHeading as="h3" className="flex-1"><span id="dep">{admin ? 'Bank account' : 'Deposits'}</span></SectionHeading>
          <Button onClick={() => setAdding(true)}><ArrowDownLeft aria-hidden="true" />Bank in</Button>
          {admin && <Button variant="secondary" onClick={() => setPaying(true)}><ArrowUpRight aria-hidden="true" />Bank out</Button>}
        </div>
        <div className="flex flex-wrap items-end gap-s3">
          <div className="w-[160px]"><Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>
          <div className="w-full sm:w-[280px]"><Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'all', label: 'All' }, { value: 'in', label: 'In' }, { value: 'out', label: 'Out' }]} /></div>
          <span className="text-caption text-ink-3">{shown.length} entries</span>
        </div>
        {rows === null ? <Skeleton h={200} /> : shown.length === 0 ? <EmptyState title="No bank movements.">Bank in and Bank out entries appear here.</EmptyState> : (
          <div className="overflow-x-auto"><table className="tx-table">
            <thead><tr><th>Date</th><th>Entry</th><th className="tx-amt">In</th><th className="tx-amt">Out</th>{admin && <th className="tx-amt hidden sm:table-cell">Balance</th>}<th>Actions</th></tr></thead>
            <tbody>
              {shown.slice(0, 400).map(({ t, bal }) => (
                <tr key={t.id} style={t.status === 'void' ? { opacity: 0.55 } : undefined}>
                  <td className="whitespace-nowrap">{fmtShortDate(t.occurred_on)}<div className="text-caption text-ink-3">{t.occurred_on.slice(0, 4)}</div></td>
                  <td className="tx-strong">
                    {t.item ?? t.description ?? kindLabel[t.kind]}
                    <div className="text-caption text-ink-3 font-normal"><span className="code">{t.doc_number}</span> · {kindLabel[t.kind]}{t.vat_amount ? ` · VAT ${amt(t.vat_amount)}` : ''}{t.status === 'void' ? ' · VOID' : ''}</div>
                  </td>
                  <td className="tx-amt pos">{t.direction === 'in' ? amt(t.amount_net) : ''}</td>
                  <td className="tx-amt neg">{t.direction === 'out' ? amt(t.amount_net) : ''}</td>
                  {admin && <td className="tx-amt hidden sm:table-cell">{amt(bal)}</td>}
                  <td>{t.status !== 'void' && (admin || (t.created_by === me.id && isPartnershipsExec(me) && ['bank_deposit', 'sponsorship'].includes(t.kind))) && <div className="flex gap-s2">
                    {t.account === 'bank' && ['bank_deposit', 'sponsorship', 'bank_out'].includes(t.kind) && <Button small variant="secondary" onClick={() => setEditing(t)}><Pencil size={16} aria-hidden="true" />Edit</Button>}
                    <Button small variant="secondary" onClick={() => setDeleting(t)}><Trash2 size={16} aria-hidden="true" />Delete</Button>
                  </div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {shown.length > 400 && <p className="text-caption text-ink-3">Showing the newest 400. Pick a year to see the rest, or use Reports.</p>}
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

      {editing && <BankEntryModal key={editing.id} entry={editing} admin={admin} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <BankEntryModal key={deleting.id} entry={deleting} admin={admin} deleting onClose={() => setDeleting(null)} onSaved={() => { setDeleting(null); load(); }} />}
      <DepositModal open={adding} sponsors={sponsors} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      {admin && <BankOutModal open={paying} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); load(); }} />}
      <SponsorModal open={addingSponsor} onClose={() => setAddingSponsor(false)} onSaved={() => { setAddingSponsor(false); load(); }} />
    </div>
  );
}

function BankOutModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) { setError('Enter the amount that left the bank.'); return; }
    if (!what.trim()) { setError('Say what it was for.'); return; }
    setBusy(true);
    try {
      const t = await financeApi.createTransaction({ kind: 'bank_out', method: 'bank', amount_gross: n, item: what.trim(), supplier: to.trim() || undefined, occurred_on: date });
      toast('ok', `${t.doc_number} recorded.`, `EGP ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })} taken out of the bank.`);
      setAmount(''); setTo(''); setWhat(''); setError(null);
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Bank out"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Amount (EGP)" type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextInput label="What for" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Venue deposit, bank fees" />
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
          <TextInput label="Paid to (optional)" value={to} onChange={(e) => setTo(e.target.value)} />
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <p className="text-caption text-ink-3">Money paid straight from the bank: transfers, cheques, bank fees. Cash bought by L&P goes under Cash out.</p>
        {error && <p className="tx-help" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      </div>
    </Modal>
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
    <Modal open={open} onClose={onClose} title="Bank in"
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

function BankEntryModal({ entry, admin, deleting = false, onClose, onSaved }: { entry: Transaction; admin: boolean; deleting?: boolean; onClose: () => void; onSaved: () => void }) {
  const [direction, setDirection] = useState<'in' | 'out'>(entry.direction);
  const [amount, setAmount] = useState(String(entry.amount_gross));
  const [date, setDate] = useState(entry.occurred_on);
  const [description, setDescription] = useState(entry.item ?? entry.description ?? '');
  const [vat, setVat] = useState(entry.vat_amount > 0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!reason.trim()) { setError('Add a reason for this change.'); return; }
    if (!deleting && (!(Number(amount) > 0) || !date)) { setError('Add a positive amount and a date.'); return; }
    setBusy(true); setError(null);
    try {
      if (deleting) await financeApi.voidTransaction(entry.id, reason.trim());
      else await financeApi.editBankTransaction(entry.id, { direction, amount: Number(amount), date, description, vat, reason: reason.trim() });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open title={deleting ? 'Delete bank entry?' : 'Edit bank entry'} onClose={() => { if (!busy) onClose(); }}
    actions={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{deleting ? 'Delete entry' : 'Save changes'}</Button></>}>
    <div className="grid gap-s4">
      <p className="text-body-sm text-ink-2">{deleting ? 'This entry will stop affecting balances. Its audit record is retained.' : 'Saving replaces this entry and keeps the original in the audit history.'}</p>
      {!deleting && <>
        <Select label="Money direction" value={direction} disabled={!admin} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}><option value="in">Money in</option><option value="out">Money out</option></Select>
        <TextInput label="Amount (EGP)" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        {direction === 'in' && <Check2 label="VAT applies" checked={vat} onChange={(e) => setVat(e.target.checked)} />}
      </>}
      <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="tx-help" role="alert">{error}</p>}
    </div>
  </Modal>;
}
