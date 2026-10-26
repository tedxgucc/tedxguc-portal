'use client';
// Finance reports (FR-12.11, FR-14.4), for the Chairman and Ops Curator.
// Pick a year (and an account), optionally compare it with another year:
// totals, month by month, by type, and who paid us / whom we paid.
// Print it or export it as a spreadsheet.
import { Download, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { EmptyState, Select, Skeleton } from '@/components/ui';
import { financeApi } from '@/lib/api/phase2';
import type { MoneyAccount, Transaction } from '@/lib/types';
import { downloadCsv, kindLabel } from '../FinanceBits';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type Sum = { in: number; out: number; net: number; n: number };
const zero = (): Sum => ({ in: 0, out: 0, net: 0, n: 0 });
const add = (s: Sum, t: Transaction) => {
  if (t.direction === 'in') s.in += t.amount_net; else s.out += t.amount_net;
  s.net = s.in - s.out;
  s.n += 1;
};
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? '—' : 'new') : `${a >= b ? '+' : ''}${Math.round(((a - b) / Math.abs(b)) * 100)}%`);
const who = (t: Transaction) => (t.supplier || t.item || t.description || kindLabel[t.kind]).trim();

export function ReportsTab() {
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [year, setYear] = useState('');
  const [cmp, setCmp] = useState('');
  const [account, setAccount] = useState<'' | MoneyAccount>('');
  useEffect(() => { financeApi.listAllTransactions().then(setAll).catch(() => setAll([])); }, []);

  const live = useMemo(() => (all ?? []).filter((t) => t.status !== 'void' && (!account || t.account === account)), [all, account]);
  const years = useMemo(() => [...new Set(live.map((t) => t.occurred_on.slice(0, 4)))].sort().reverse(), [live]);
  useEffect(() => {
    if (!years.length) return;
    setYear((y) => y || years[0]);
    setCmp((c) => c || years[1] || '');
  }, [years]);

  const byYear = useMemo(() => {
    const m = new Map<string, Sum>();
    for (const t of live) { const y = t.occurred_on.slice(0, 4); if (!m.has(y)) m.set(y, zero()); add(m.get(y)!, t); }
    return m;
  }, [live]);
  const months = (y: string) => {
    const r = MONTHS.map(zero);
    for (const t of live) if (t.occurred_on.startsWith(y)) add(r[Number(t.occurred_on.slice(5, 7)) - 1], t);
    return r;
  };
  const kinds = (y: string) => {
    const m = new Map<string, Sum>();
    for (const t of live) if (t.occurred_on.startsWith(y)) { const k = kindLabel[t.kind]; if (!m.has(k)) m.set(k, zero()); add(m.get(k)!, t); }
    return m;
  };
  const top = (y: string, d: 'in' | 'out') => {
    const m = new Map<string, number>();
    for (const t of live) if (t.occurred_on.startsWith(y) && t.direction === d) m.set(who(t), (m.get(who(t)) ?? 0) + t.amount_net);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  // Balance at the end of a year: everything up to 31 Dec.
  const closing = (y: string) => live.filter((t) => t.occurred_on <= `${y}-12-31`).reduce((s, t) => s + (t.direction === 'in' ? t.amount_net : -t.amount_net), 0);

  if (all === null) return <Skeleton h={300} />;
  if (!years.length) return <EmptyState title="Nothing to report yet">Reports fill in as money is recorded.</EmptyState>;

  const A = byYear.get(year) ?? zero();
  const B = cmp ? byYear.get(cmp) ?? zero() : null;
  const mA = months(year);
  const mB = cmp ? months(cmp) : null;
  const kA = kinds(year);
  const kB = cmp ? kinds(cmp) : null;
  const kindNames = [...new Set([...kA.keys(), ...(kB?.keys() ?? [])])];
  const peak = Math.max(1, ...mA.map((x) => Math.max(x.in, x.out)), ...(mB ?? []).map((x) => Math.max(x.in, x.out)));
  const accountName = account ? { bank: 'Bank', cash: 'Cash', telda: 'Telda' }[account] : 'All accounts';

  const exportCsv = () => {
    const head = ['Month', `In ${year}`, `Out ${year}`, `Net ${year}`, ...(cmp ? [`In ${cmp}`, `Out ${cmp}`, `Net ${cmp}`, 'Change in net'] : [])];
    const rows = MONTHS.map((m, i) => [m, mA[i].in, mA[i].out, mA[i].net, ...(mB ? [mB[i].in, mB[i].out, mB[i].net, mA[i].net - mB[i].net] : [])]);
    rows.push(['Total', A.in, A.out, A.net, ...(B ? [B.in, B.out, B.net, A.net - B.net] : [])]);
    downloadCsv(`tedxguc-report-${year}${cmp ? `-vs-${cmp}` : ''}${account ? `-${account}` : ''}.csv`, head, rows.map((r) => r.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))));
  };

  // For money out, going up is bad news: the colour flips.
  const tile = (label: string, a: number, b?: number, upIsGood = true) => (
    <div className="tx-card tx-kpi">
      <span className="tx-label">{label}</span>
      <span className="money">EGP {fmt(a)}</span>
      {b !== undefined && <span className="caption tx-faint">{cmp}: EGP {fmt(b)} · <b className={(a >= b) === upIsGood ? 'text-ok' : 'text-bad'}>{pct(a, b)}</b></span>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-s6" id="report">
      <div className="flex flex-wrap items-end gap-s3 print:hidden">
        <div className="w-[140px]"><Select label="Year" value={year} onChange={(e) => { const y = e.target.value; setYear(y); if (y === cmp) setCmp(years.find((x) => x !== y) ?? ''); }}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>
        <div className="w-[170px]"><Select label="Compare with" value={cmp} onChange={(e) => setCmp(e.target.value)}><option value="">No comparison</option>{years.filter((y) => y !== year).map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>
        <div className="w-[170px]"><Select label="Account" value={account} onChange={(e) => setAccount(e.target.value as '' | MoneyAccount)}><option value="">All accounts</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="telda">Telda</option></Select></div>
        <button type="button" className="tx-btn tx-btn--secondary tx-btn--sm" onClick={() => window.print()}><Printer aria-hidden="true" />Print</button>
        <button type="button" className="tx-btn tx-btn--secondary tx-btn--sm" onClick={exportCsv}><Download aria-hidden="true" />Export</button>
      </div>

      <div className="grid gap-s1">
        <span className="tx-label">TEDxGUC finance report · {accountName}</span>
        <h2 className="h2 uppercase">{year}{cmp ? ` vs ${cmp}` : ''}</h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-s2">
        {tile('Money in', A.in, B?.in)}
        {tile('Money out', A.out, B?.out, false)}
        {tile('Net', A.net, B?.net)}
        {tile(`Balance at end of ${year}`, closing(year), cmp ? closing(cmp) : undefined)}
      </div>

      <section className="grid gap-s3" aria-labelledby="months">
        <SectionHeading as="h3"><span id="months">Month by month</span></SectionHeading>
        <div className="grid gap-s1" aria-hidden="true">
          {MONTHS.map((m, i) => (
            <div key={m} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-s2 text-caption">
              <span className="text-ink-3">{m}</span>
              <div className="grid gap-[2px]">
                <div className="flex gap-[2px] items-center"><span className="h-[8px] bg-ok" style={{ width: `${(mA[i].in / peak) * 100}%` }} /><span className="h-[8px] bg-accent" style={{ width: `${(mA[i].out / peak) * 100}%` }} /></div>
                {mB && <div className="flex gap-[2px] items-center opacity-40"><span className="h-[6px] bg-ok" style={{ width: `${(mB[i].in / peak) * 100}%` }} /><span className="h-[6px] bg-accent" style={{ width: `${(mB[i].out / peak) * 100}%` }} /></div>}
              </div>
            </div>
          ))}
          <p className="text-caption text-ink-3 mt-s1"><span className="inline-block w-[10px] h-[8px] bg-ok mr-s1" />In · <span className="inline-block w-[10px] h-[8px] bg-accent mx-s1" />Out{mB ? ` · faded bars: ${cmp}` : ''}</p>
        </div>
        <div className="overflow-x-auto"><table className="tx-table">
          <thead><tr><th>Month</th><th className="tx-amt">In {year}</th><th className="tx-amt">Out {year}</th><th className="tx-amt">Net {year}</th>{mB && <><th className="tx-amt">Net {cmp}</th><th className="tx-amt">Change</th></>}</tr></thead>
          <tbody>
            {MONTHS.map((m, i) => (
              <tr key={m}>
                <td>{m}</td><td className="tx-amt">{fmt(mA[i].in)}</td><td className="tx-amt">{fmt(mA[i].out)}</td>
                <td className={`tx-amt ${mA[i].net < 0 ? 'neg' : ''}`}>{fmt(mA[i].net)}</td>
                {mB && <><td className="tx-amt">{fmt(mB[i].net)}</td><td className={`tx-amt ${mA[i].net - mB[i].net < 0 ? 'neg' : 'pos'}`}>{fmt(mA[i].net - mB[i].net)}</td></>}
              </tr>
            ))}
            <tr className="tx-strong"><td>Total</td><td className="tx-amt">{fmt(A.in)}</td><td className="tx-amt">{fmt(A.out)}</td><td className="tx-amt">{fmt(A.net)}</td>{B && <><td className="tx-amt">{fmt(B.net)}</td><td className="tx-amt">{fmt(A.net - B.net)}</td></>}</tr>
          </tbody>
        </table></div>
      </section>

      <section className="grid gap-s3" aria-labelledby="types">
        <SectionHeading as="h3"><span id="types">By type</span></SectionHeading>
        <div className="overflow-x-auto"><table className="tx-table">
          <thead><tr><th>Type</th><th className="tx-amt">In {year}</th><th className="tx-amt">Out {year}</th>{kB && <><th className="tx-amt">In {cmp}</th><th className="tx-amt">Out {cmp}</th></>}</tr></thead>
          <tbody>{kindNames.map((k) => (
            <tr key={k}><td>{k}</td><td className="tx-amt">{fmt(kA.get(k)?.in ?? 0)}</td><td className="tx-amt">{fmt(kA.get(k)?.out ?? 0)}</td>
              {kB && <><td className="tx-amt">{fmt(kB.get(k)?.in ?? 0)}</td><td className="tx-amt">{fmt(kB.get(k)?.out ?? 0)}</td></>}</tr>
          ))}</tbody>
        </table></div>
      </section>

      <div className="grid grid-cols-1 gap-s6 lg:grid-cols-2">
        {(['in', 'out'] as const).map((d) => (
          <section key={d} className="grid gap-s3 min-w-0 overflow-hidden">
            <SectionHeading as="h3"><span className="min-w-0">{d === 'in' ? `Top in · ${year}` : `Top out · ${year}`}</span></SectionHeading>
            {top(year, d).length === 0 ? <p className="text-body-sm text-ink-3">Nothing in {year}.</p> : (
              <ol className="grid gap-s1">
                {top(year, d).map(([name, v], i) => (
                  <li key={name} className="flex items-baseline gap-s2 border-b border-line py-s1 text-body-sm">
                    <span className="text-ink-3 tx-num w-[20px]">{i + 1}</span><span className="flex-1 min-w-0 truncate">{name}</span><span className="tx-num font-semibold shrink-0">{fmt(v)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <section className="grid gap-s3" aria-labelledby="years">
        <SectionHeading as="h3"><span id="years">Every year</span></SectionHeading>
        <div className="overflow-x-auto"><table className="tx-table">
          <thead><tr><th>Year</th><th className="tx-amt">In</th><th className="tx-amt">Out</th><th className="tx-amt">Net</th><th className="tx-amt">Balance at year end</th><th className="tx-amt">Entries</th></tr></thead>
          <tbody>{[...years].reverse().map((y) => { const s = byYear.get(y)!; return (
            <tr key={y} className={y === year || y === cmp ? 'tx-strong' : ''}><td>{y}</td><td className="tx-amt">{fmt(s.in)}</td><td className="tx-amt">{fmt(s.out)}</td><td className={`tx-amt ${s.net < 0 ? 'neg' : ''}`}>{fmt(s.net)}</td><td className="tx-amt">{fmt(closing(y))}</td><td className="tx-amt">{s.n}</td></tr>
          ); })}</tbody>
        </table></div>
      </section>
    </div>
  );
}
