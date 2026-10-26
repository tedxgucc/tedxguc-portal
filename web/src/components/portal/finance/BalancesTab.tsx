'use client';
// Balances (FR-12.5, 12.6, 12.8, 12.9, 12.11), for the Operations Curator
// and the Chairman: live balances per account, division budgets (Chairman
// sets them), monthly reconciliation, and the full cashbook with filters,
// export and void.
import { Ban, Download, Pencil, Scale } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, Modal, Select, Skeleton, TextInput } from '@/components/ui';
import { financeApi } from '@/lib/api/phase2';
import { egp, fmtShortDate } from '@/lib/format';
import type { Balances, BudgetStatus, MoneyAccount, Reconciliation, Transaction } from '@/lib/types';
import { downloadCsv, FatoraChip, kindLabel, methodLabel, Money, signed } from '../FinanceBits';
import { VoidModal } from './CashOutTab';

export function BalancesTab() {
  const { me, divisions, team, memberName } = usePortal();
  const [b, setB] = useState<Balances | null>(null);
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Record<string, BudgetStatus>>({});
  const [kind, setKind] = useState('');
  const [account, setAccount] = useState('');
  const [month, setMonth] = useState('');
  const [voiding, setVoiding] = useState<Transaction | null>(null);
  const [editBudget, setEditBudget] = useState<string | null>(null);

  const load = useCallback(() => {
    financeApi.balances().then(setB).catch(() => {});
    financeApi.listTransactions().then(setTxns).catch(() => setTxns([]));
    Promise.all(divisions.map(async (d) => [d.id, await financeApi.divisionBudget(d.id).catch(() => null)] as const))
      .then((rows) => setBudgets(Object.fromEntries(rows.filter(([, v]) => v) as [string, BudgetStatus][])));
  }, [divisions]);
  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => [...new Set((txns ?? []).map((t) => t.occurred_on.slice(0, 7)))].sort().reverse(), [txns]);
  const shown = (txns ?? []).filter((t) => (!kind || t.kind === kind) && (!account || t.account === account) && (!month || t.occurred_on.startsWith(month)));
  const tile = (label: string, value: number, note?: string) => (
    <div className="tx-card tx-kpi"><span className="tx-label">{label}</span><span className="money"><Money value={value} /></span>{note && <span className="caption tx-faint">{note}</span>}</div>
  );
  const exportCsv = () => downloadCsv('tedxguc-cashbook.csv',
    ['Number', 'Date', 'Kind', 'Account', 'Item / description', 'Supplier', 'Team', 'Gross', 'VAT', 'Net', 'In/Out', 'Fatora', 'Status', 'Void reason', 'Recorded by'],
    shown.map((t) => [t.doc_number, t.occurred_on, kindLabel[t.kind], t.account, t.item ?? t.description, t.supplier, team(t.team_id)?.name ?? '', t.amount_gross, t.vat_amount, t.amount_net, t.direction, t.fatora_path ? 'yes' : t.kind === 'cash_out' ? 'MISSING' : '', t.status, t.void_reason, t.created_by ? memberName(t.created_by) : '']));

  return (
    <div className="grid grid-cols-1 gap-s6">
      {b ? (
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-3 gap-s2 md:gap-s4">
          <div className="tx-card tx-card--red tx-kpi col-span-2 lg:col-span-1">
            <span className="tx-label" style={{ color: '#fff' }}>Total</span>
            <span className="stat tx-num break-words" style={{ fontSize: "clamp(28px, 8vw, 40px)" }}>{egp(b.bank + b.telda + b.cash)}</span>
          </div>
          {tile('Bank account', b.bank)}
          {tile('Cash on hand', b.cash)}
          {tile('Telda', b.telda)}
          {tile('VAT collected', b.vat_collected, 'Owed on deposits')}
          <div className="tx-card tx-kpi"><span className="tx-label">Missing fatoras</span><span className={`stat tx-num ${b.cash_outs_missing_fatora ? 'text-bad' : ''}`}>{b.cash_outs_missing_fatora}</span><span className="caption tx-faint">{egp(b.pending_sponsorships)} in sponsor deals pending</span></div>
        </div>
      ) : <Skeleton h={180} />}

      <section className="grid gap-s3" aria-labelledby="bud">
        <SectionHeading as="h3"><span id="bud">Division budgets</span></SectionHeading>
        <div className="overflow-x-auto"><table className="tx-table">
          <thead><tr><th>Division</th><th className="tx-amt">Budget</th><th className="tx-amt hidden sm:table-cell">Spent</th><th className="tx-amt hidden md:table-cell">Approved</th><th className="tx-amt">Left</th>{me.role === 'chairman' && <th><span className="sr-only">Edit</span></th>}</tr></thead>
          <tbody>
            {divisions.map((d) => {
              const s = budgets[d.id];
              return (
                <tr key={d.id}>
                  <td className="tx-strong">{d.name}</td>
                  <td className="tx-amt">{s?.budget === null || !s ? '—' : s.budget.toLocaleString('en-US')}</td>
                  <td className="tx-amt hidden sm:table-cell">{s ? s.spent.toLocaleString('en-US') : '—'}</td>
                  <td className="tx-amt hidden md:table-cell">{s ? s.approved_not_bought.toLocaleString('en-US') : '—'}</td>
                  <td className={`tx-amt ${s?.remaining !== null && s && s.remaining < 0 ? 'neg' : ''}`}>{s?.remaining === null || !s ? '—' : s.remaining.toLocaleString('en-US')}</td>
                  {me.role === 'chairman' && <td className="text-right"><button className="tx-iconbtn" aria-label={`Set budget for ${d.name}`} onClick={() => setEditBudget(d.id)}><Pencil size={18} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="text-caption text-ink-3">{me.role === 'chairman' ? 'You set each division’s season budget. ' : 'The chairman sets budgets. '}Curators see only their own division’s line, never the balances.</p>
      </section>

      <Reconcile />

      <section className="grid gap-s3" aria-labelledby="book">
        <div className="flex flex-wrap items-center gap-s3">
          <SectionHeading as="h3" className="flex-1"><span id="book">Cashbook ({shown.length})</span></SectionHeading>
          <Button variant="secondary" small onClick={exportCsv} disabled={!shown.length}><Download aria-hidden="true" />Export</Button>
        </div>
        <div className="grid gap-s3 sm:grid-cols-3">
          <Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All</option>{Object.entries(kindLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Account" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="telda">Telda</option>
          </Select>
          <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All</option>{months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
          </Select>
        </div>
        {txns === null ? <Skeleton h={240} /> : (
          <div className="overflow-x-auto"><table className="tx-table">
            <thead><tr><th>Entry</th><th className="hidden md:table-cell">Kind</th><th className="hidden lg:table-cell">Team</th><th className="tx-amt">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} style={t.status === 'void' ? { opacity: 0.55 } : undefined}>
                  <td className="tx-strong">
                    {t.item ?? t.description ?? kindLabel[t.kind]}
                    <div className="flex flex-wrap items-center gap-s1 mt-[2px] text-caption text-ink-3 font-normal">
                      <span className="code">{t.doc_number}</span> · {fmtShortDate(t.occurred_on)} · {methodLabel[t.method]}
                      <span className="md:hidden">· {kindLabel[t.kind]}</span>
                      {t.status === 'void' ? <Chip kind="void">Void: {t.void_reason}</Chip> : <FatoraChip t={t} />}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">{kindLabel[t.kind]}</td>
                  <td className="hidden lg:table-cell">{team(t.team_id)?.name ?? '—'}</td>
                  <td className={`tx-amt ${t.direction === 'in' ? 'pos' : 'neg'}`}>{t.direction === 'in' ? '+ ' : '− '}{t.amount_net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="text-right">{t.status !== 'void' && t.kind !== 'opening_balance' && <button className="tx-iconbtn" aria-label={`Void ${t.doc_number}`} onClick={() => setVoiding(t)}><Ban size={18} /></button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td className="tx-strong" colSpan={3}>Net of shown entries</td><td className="tx-amt">{egp(shown.filter((t) => t.status !== 'void').reduce((a, t) => a + signed(t), 0))}</td><td /></tr></tfoot>
          </table></div>
        )}
      </section>

      <VoidModal txn={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); load(); }} />
      <BudgetModal divisionId={editBudget} current={editBudget ? budgets[editBudget]?.budget ?? null : null} onClose={() => setEditBudget(null)} onSaved={() => { setEditBudget(null); load(); }} />
    </div>
  );
}

function Reconcile() {
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [acc, setAcc] = useState<MoneyAccount>('bank');
  const [statement, setStatement] = useState('');
  const [result, setResult] = useState<Reconciliation | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (statement === '') return;
    setBusy(true);
    try { setResult(await financeApi.reconcile(`${month}-01`, acc, Number(statement))); }
    catch (e) { toast('bad', 'Couldn’t check.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="tx-card grid gap-s4" aria-labelledby="rec">
      <h3 id="rec" className="tx-heading h3">Monthly check</h3>
      <p className="text-body-sm text-ink-2 -mt-s2">Enter the bank statement balance or the counted cash; we compare it with the cashbook.</p>
      <div className="grid gap-s3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <TextInput label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Select label="Account" value={acc} onChange={(e) => setAcc(e.target.value as MoneyAccount)}><option value="bank">Bank</option><option value="cash">Cash (counted)</option><option value="telda">Telda</option></Select>
        <TextInput label="Statement / counted (EGP)" type="number" inputMode="decimal" value={statement} onChange={(e) => setStatement(e.target.value)} />
        <Button onClick={run} loading={busy} disabled={statement === ''}><Scale aria-hidden="true" />Check</Button>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-s2 text-center" aria-live="polite">
          <div><div className="tx-label">Cashbook</div><div className="font-semibold tabular-nums">{egp(result.book_balance)}</div></div>
          <div><div className="tx-label">Statement</div><div className="font-semibold tabular-nums">{egp(result.statement_balance)}</div></div>
          <div><div className="tx-label">Difference</div><div className={`font-semibold tabular-nums ${result.difference === 0 ? 'text-ok' : 'text-bad'}`}>{result.difference === 0 ? 'Matches' : egp(result.difference)}</div></div>
        </div>
      )}
    </section>
  );
}

function BudgetModal({ divisionId, current, onClose, onSaved }: { divisionId: string | null; current: number | null; onClose: () => void; onSaved: () => void }) {
  const { divisions } = usePortal();
  const toast = useToast();
  const [v, setV] = useState('');
  useEffect(() => setV(current === null ? '' : String(current)), [current, divisionId]);
  const d = divisions.find((x) => x.id === divisionId);
  return (
    <Modal open={!!divisionId} onClose={onClose} title={`Budget for ${d?.name ?? ''}`}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={async () => {
        try { await financeApi.setBudget(divisionId!, Number(v)); toast('ok', 'Budget saved.'); onSaved(); } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
      }} disabled={v === '' || Number(v) < 0}>Save</Button></>}>
      <TextInput label="Season budget (EGP)" type="number" inputMode="decimal" min={0} value={v} onChange={(e) => setV(e.target.value)} />
    </Modal>
  );
}
