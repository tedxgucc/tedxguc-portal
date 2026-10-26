'use client';
// Manage sign-ups (packages, trips, anything that needs registration).
// Only for the Chairman, the OD and Operations Curators, and the L&P and
// AE Executives. Associates never see this page; they sign up from
// /portal/signups. Managers build each form like a Google Form, check
// payments, scan pickups and export the responses.
import { Ban, Check, Download, Image as ImageIcon, Pencil, Plus, ScanLine, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { downloadCsv } from '@/components/portal/FinanceBits';
import { usePortal } from '@/components/portal/PortalContext';
import { QrScanner } from '@/components/QrScanner';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { packagesApi, type PickupResult } from '@/lib/api/phase2b';
import { egp, fmtRelative, fromLocalInput, toLocalInput } from '@/lib/format';
import { answerText, FormBuilder } from '@/components/portal/FormBuilder';
import { canLeadOperations, canManageSignUps } from '@/lib/roles';
import { kindLabel } from '@/lib/signups';
import type { FormQuestion, Order, OrderStatus, Package, SalesRow, SignUpKind } from '@/lib/types';


type Tab = 'orders' | 'pickup' | 'packages' | 'sales';

const orderChip = (s: OrderStatus) => {
  const m: Record<OrderStatus, ['ok' | 'bad' | 'pending' | 'void' | 'soft', string]> = {
    pending_proof: ['soft', 'Waiting for payment'], pending_approval: ['pending', 'Check transfer'], awaiting_cash: ['pending', 'Cash at booth'],
    approved: ['ok', 'Paid'], delivered: ['ok', 'Picked up'], rejected: ['bad', 'Rejected'], expired: ['void', 'Expired'], cancelled: ['void', 'Cancelled'], refunded: ['void', 'Refunded'],
  };
  return <Chip kind={m[s][0]}>{m[s][1]}</Chip>;
};
const methodName = { instapay: 'InstaPay', telda: 'Telda', cash: 'Cash' } as const;

export default function PortalPackages() {
  const { me } = usePortal();
  const lead = canLeadOperations(me);
  const tabs: { value: Tab; label: string }[] = [
    { value: 'packages', label: 'Sign-ups' }, { value: 'orders', label: 'Responses' }, { value: 'pickup', label: 'Pickup' }, { value: 'sales', label: 'Money' },
  ];
  const [tab, setTab] = useState<Tab>('packages');
  if (!canManageSignUps(me)) return <EmptyState title="For sign-up managers">The Chairman, the OD and Operations Curators, and the L&P and AE Executives manage sign-ups.</EmptyState>;
  return (
    <>
      <PageTitle label="Manage sign-ups" title={tabs.find((t) => t.value === tab)!.label} />
      <div className="mb-s5 overflow-x-auto -mx-s4 px-s4"><div className="min-w-[400px] max-w-[640px]"><Segmented label="Packages view" value={tab} onChange={setTab} options={tabs} /></div></div>
      {tab === 'orders' && <Orders lead={lead} />}
      {tab === 'pickup' && <Pickup />}
      {tab === 'packages' && <Packages />}
      {tab === 'sales' && <Sales />}
    </>
  );
}

function Orders({ lead }: { lead: boolean }) {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [pkgs, setPkgs] = useState<Package[]>([]);
  const [filter, setFilter] = useState<'todo' | 'all'>('all');
  const [pick, setPick] = useState('');
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [proof, setProof] = useState<Order | null>(null);
  const load = useCallback(() => {
    packagesApi.listOrders().then(setOrders).catch(() => setOrders([]));
    packagesApi.listPackages().then(setPkgs).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const pname = (id: string) => pkgs.find((p) => p.id === id)?.name ?? 'Sign-up';
  const mine = (orders ?? []).filter((o) => !pick || o.package_id === pick);
  const todo = mine.filter((o) => ['pending_approval', 'awaiting_cash'].includes(o.status));
  const shown = filter === 'todo' ? todo : mine;
  const qs = (id: string): FormQuestion[] => pkgs.find((p) => p.id === id)?.questions ?? [];
  const exportResponses = () => {
    const p = pkgs.find((x) => x.id === pick);
    const questions = p?.questions ?? [];
    downloadCsv(`${(p?.name ?? 'sign-ups').toLowerCase().replace(/\W+/g, '-')}-responses.csv`,
      ['Number', 'Sign-up', 'Name', 'Email', 'Phone', 'Quantity', 'Status', 'Total EGP', 'Signed up', ...questions.map((q) => q.label)],
      mine.map((o) => [o.order_no, pname(o.package_id), o.buyer_name, o.buyer_email, o.buyer_phone, o.quantity, o.status, o.total_egp, o.created_at,
        ...questions.map((q) => answerText(o.answers?.[q.id]))]));
  };
  const act = async (fn: () => Promise<void>, ok: string, detail?: string) => {
    try { await fn(); toast('ok', ok, detail); load(); } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };

  return (
    <div className="grid gap-s4">
      <div className="flex flex-wrap items-end gap-s3">
        <div className="w-full sm:w-[280px]">
          <Select label="Sign-up" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">All sign-ups</option>
            {pkgs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-[260px]"><Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: `All ${mine.length}` }, { value: 'todo', label: `To check ${todo.length}` }]} /></div>
        <Button small variant="secondary" disabled={!mine.length} onClick={exportResponses}><Download aria-hidden="true" />Export responses</Button>
      </div>
      {orders === null ? <Skeleton h={240} /> : shown.length === 0 ? <EmptyState title={filter === 'todo' ? 'Nothing to check.' : 'No orders yet.'}>{filter === 'todo' ? 'New transfers and cash payments land here.' : 'Members’ sign-ups show up here.'}</EmptyState> : (
        <ul className="grid gap-s2">
          {shown.map((o) => (
            <li key={o.id} className="tx-card grid gap-s3">
              <div className="flex flex-wrap items-start justify-between gap-s2">
                <div className="grid grid-cols-1 min-w-0">
                  <span className="code text-ink-3">{o.order_no}</span>
                  <span className="font-semibold">{o.buyer_name} · {o.quantity} × {pname(o.package_id)}</span>
                  <span className="text-caption text-ink-3 truncate">{methodName[o.method]} · {o.buyer_phone} · {fmtRelative(o.created_at)}{o.fulfilment === 'delivery' ? ` · deliver to ${o.delivery_address}` : ''}</span>
                </div>
                <span className="grid justify-items-end gap-s1"><span className="money">{o.total_egp ? egp(o.total_egp) : 'Free'}</span>{orderChip(o.status)}</span>
              </div>
              {qs(o.package_id).length > 0 && o.answers && (
                <dl className="grid gap-x-s4 gap-y-s1 sm:grid-cols-2 text-body-sm">
                  {qs(o.package_id).map((q) => (
                    <div key={q.id} className="min-w-0"><dt className="text-caption text-ink-3">{q.label}</dt><dd className="break-words">{answerText(o.answers?.[q.id]) || '—'}</dd></div>
                  ))}
                </dl>
              )}
              {o.status === 'pending_approval' && (
                <div className="grid gap-s2">
                  <p className="text-body-sm text-ink-2">Find {egp(o.total_egp)} with note <b className="code">{o.order_no}</b> in the {methodName[o.method]} account.{o.payment_reference ? ` Reference: ${o.payment_reference}.` : ''}</p>
                  <div className="flex flex-wrap gap-s2">
                    {o.proof_path && <Button small variant="ghost" onClick={() => setProof(o)}><ImageIcon aria-hidden="true" />Screenshot</Button>}
                    <Button small variant="secondary" onClick={() => setRejecting(o)}><X aria-hidden="true" />Reject</Button>
                    <Button small onClick={() => act(() => packagesApi.decideOrder(o.id, true), `${o.order_no} confirmed.`, 'The buyer gets their pickup QR. It’s in the cashbook.')}><Check aria-hidden="true" />Approve</Button>
                  </div>
                </div>
              )}
              {o.status === 'awaiting_cash' && (
                <Button small className="justify-self-start" onClick={() => act(() => packagesApi.markCashPaid(o.id), `${o.order_no} paid in cash.`, 'Added to cash on hand.')}>Mark paid {egp(o.total_egp)}</Button>
              )}
              {lead && ['approved', 'delivered'].includes(o.status) && <Button small variant="ghost" className="justify-self-start" onClick={() => setRefunding(o)}><Ban aria-hidden="true" />Refund</Button>}
              {o.reject_reason && <p className="text-body-sm text-ink-3">“{o.reject_reason}”</p>}
            </li>
          ))}
        </ul>
      )}
      <ReasonModal order={rejecting} title="Reject this payment?" action="Reject" onClose={() => setRejecting(null)} onConfirm={(r) => act(() => packagesApi.decideOrder(rejecting!.id, false, r), 'Payment rejected.', 'The buyer is emailed with your reason.').then(() => setRejecting(null))} />
      <ReasonModal order={refunding} title="Refund this order?" action="Refund" required onClose={() => setRefunding(null)} onConfirm={(r) => act(() => packagesApi.refund(refunding!.id, r), 'Refunded.', 'A reversing entry is in the cashbook.').then(() => setRefunding(null))} />
      {proof && <ProofModal order={proof} onClose={() => setProof(null)} />}
    </div>
  );
}

function ProofModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => { if (order.proof_path) packagesApi.proofUrl(order.proof_path).then(setUrl).catch(() => setUrl(null)); }, [order]);
  return (
    <Modal open onClose={onClose} title={`${order.order_no} transfer`}>
      {url === undefined ? <Skeleton h={200} /> : url
        ? (/\.pdf($|\?)/.test(order.proof_path ?? '') ? <a className="tx-link" href={url} target="_blank" rel="noopener noreferrer">Open the PDF</a> : <img src={url} alt="Transfer screenshot" className="w-full" />) /* eslint-disable-line @next/next/no-img-element */
        : <p className="text-ink-2">Screenshots open in live mode. Demo mode has no real files.</p>}
      {order.payment_reference && <p className="text-body-sm mt-s3">Reference: <span className="code">{order.payment_reference}</span></p>}
    </Modal>
  );
}

function ReasonModal({ order, title, action, required, onClose, onConfirm }: { order: Order | null; title: string; action: string; required?: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={!!order} onClose={onClose} title={order ? `${title.replace('?', '')} ${order.order_no}?` : ''}
      actions={<><Button variant="secondary" onClick={onClose}>Keep</Button><Button variant="danger" disabled={required && !reason.trim()} onClick={() => { onConfirm(reason.trim()); setReason(''); }}>{action}</Button></>}>
      <TextInput label={required ? 'Reason' : 'Reason (sent to the buyer)'} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function Pickup() {
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState('');
  const [res, setRes] = useState<PickupResult | null>(null);
  const toast = useToast();
  const scan = async (c: string) => {
    if (!c.trim()) return;
    try {
      const r = await packagesApi.pickup(c.trim());
      setRes(r);
      if (navigator.vibrate) navigator.vibrate(r.result === 'ok' ? 30 : [60, 40, 60]);
      setTimeout(() => setRes((cur) => (cur === r ? null : cur)), 2500);
    } catch (e) { toast('bad', 'That didn’t work.', (e as Error).message); }
  };
  const words: Record<PickupResult['result'], [string, string]> = {
    ok: ['Hand it over', `${res?.quantity ?? ''} × ${res?.package ?? ''} for ${res?.buyer_name ?? ''}`],
    already_delivered: ['Already picked up', `${res?.order_no ?? ''} was collected before.`],
    not_paid: ['Not paid', `${res?.order_no ?? ''} isn’t confirmed yet (${(res?.status ?? '').replace('_', ' ')}).`],
    not_found: ['Not an order', 'This code isn’t a package order.'],
  };
  return (
    <div className="grid gap-s4 max-w-[560px]">
      <div className="tx-card grid gap-s4">
        <QrScanner active={camera} onCode={(t) => { setCamera(false); scan(t); }} />
        {res && (
          <div className="tx-checkin py-s3">
            <div className={`tx-checkin__stamp ${res.result === 'ok' ? '' : res.result === 'already_delivered' ? 'is-warn' : 'is-bad'}`}>{res.result === 'ok' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}</div>
            <div className="tx-checkin__t">{words[res.result][0]}</div>
            <p className="text-ink-2">{words[res.result][1]}</p>
          </div>
        )}
        <Button onClick={() => setCamera((c) => !c)}><ScanLine aria-hidden="true" />{camera ? 'Stop camera' : 'Scan pickup QR'}</Button>
        <div className="grid gap-s2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <TextInput label="Or type the code or order number" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          <Button variant="secondary" onClick={() => { scan(code); setCode(''); }}>Check</Button>
        </div>
      </div>
    </div>
  );
}

function Packages() {
  const [pkgs, setPkgs] = useState<Package[] | null>(null);
  const [editing, setEditing] = useState<Package | 'new' | null>(null);
  const load = useCallback(() => packagesApi.listPackages().then(setPkgs).catch(() => setPkgs([])), []);
  useEffect(() => { load(); }, [load]);
  if (editing) return <PackageEditor pkg={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  return (
    <div className="grid gap-s4">
      <Button className="justify-self-start" onClick={() => setEditing('new')}><Plus aria-hidden="true" />New sign-up</Button>
      {pkgs === null ? <Skeleton h={200} /> : (
        <ul className="grid gap-s2 md:grid-cols-2">
          {pkgs.map((p) => (
            <li key={p.id} className="tx-card grid gap-s2 content-start">
              <div className="flex items-start justify-between gap-s2">
                <span className="grid min-w-0"><span className="tx-label">{kindLabel[p.kind ?? 'package']}</span><span className="font-semibold">{p.name}</span></span>
                {p.is_active ? <Chip kind="ok">Open</Chip> : <Chip kind="void">Hidden</Chip>}
              </div>
              <p className="text-body-sm text-ink-2">{p.price_egp ? egp(p.price_egp) : 'Free'} · {p.stock_left} of {p.stock} places left · {p.questions?.length ?? 0} questions</p>
              <Button small variant="secondary" className="justify-self-start" onClick={() => setEditing(p)}><Pencil aria-hidden="true" />Edit</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PackageEditor({ pkg, onClose, onSaved }: { pkg: Package | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    kind: (pkg?.kind ?? 'package') as SignUpKind, name: pkg?.name ?? '', description: pkg?.description ?? '', contents: (pkg?.contents ?? []).join('\n'),
    price: pkg?.price_egp?.toString() ?? '0', stock: pkg?.stock?.toString() ?? '', max: pkg?.max_per_order?.toString() ?? '1',
    opens: pkg?.opens_at ? toLocalInput(pkg.opens_at) : '', closes: pkg?.closes_at ? toLocalInput(pkg.closes_at) : '',
    pickup: pkg?.pickup_info ?? '', delivery: pkg?.allows_delivery ?? false, active: pkg?.is_active ?? false,
  });
  const [questions, setQuestions] = useState<FormQuestion[]>(pkg?.questions ?? []);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim() || !(Number(f.price) >= 0) || !(Number(f.stock) > 0)) { toast('bad', 'Add a name, a price (0 for free) and the number of places.'); return; }
    if (questions.some((q) => !q.label.trim())) { toast('bad', 'Every question needs a title.'); return; }
    if (questions.some((q) => ['choice', 'checkboxes', 'dropdown'].includes(q.kind) && q.options.filter((o) => o.trim()).length < 2)) { toast('bad', 'Choice questions need at least two options.'); return; }
    setBusy(true);
    try {
      await packagesApi.savePackage({
        id: pkg?.id, kind: f.kind, questions: questions.map((q) => ({ ...q, label: q.label.trim(), options: q.options.map((o) => o.trim()).filter(Boolean) })),
        name: f.name.trim(), photo_url: pkg?.photo_url ?? null, description: f.description.trim() || null,
        contents: f.contents.split('\n').map((x) => x.trim()).filter(Boolean), price_egp: Number(f.price), stock: Number(f.stock), max_per_order: Number(f.max) || 1,
        opens_at: f.opens ? fromLocalInput(f.opens) : null, closes_at: f.closes ? fromLocalInput(f.closes) : null,
        is_active: f.active, pickup_info: f.pickup.trim() || null, allows_delivery: f.delivery,
      });
      toast('ok', 'Saved.', f.active ? 'Members can sign up from the portal now.' : 'Hidden until you open it.');
      onSaved();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-s6 max-w-[820px]">
      <section className="tx-card grid gap-s4">
        <h2 className="tx-heading h3">{pkg ? `Edit ${pkg.name}` : 'New sign-up'}</h2>
        <div className="grid gap-s2"><span className="tx-label">What is it?</span>
          <Segmented label="Kind" value={f.kind} onChange={(v) => set('kind', v)} options={[{ value: 'package', label: 'Package' }, { value: 'trip', label: 'Trip' }, { value: 'other', label: 'Other' }]} />
        </div>
        <TextInput label="Title" value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        <TextArea label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        <TextArea label="What’s included (one per line)" value={f.contents} onChange={(e) => set('contents', e.target.value)} rows={3} />
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-3">
          <TextInput label="Price (EGP, 0 = free)" type="number" min={0} value={f.price} onChange={(e) => set('price', e.target.value)} />
          <TextInput label="Places" type="number" min={1} value={f.stock} onChange={(e) => set('stock', e.target.value)} />
          <TextInput label="Max per person" type="number" min={1} value={f.max} onChange={(e) => set('max', e.target.value)} />
        </div>
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
          <TextInput label="Opens" type="datetime-local" value={f.opens} onChange={(e) => set('opens', e.target.value)} />
          <TextInput label="Closes" type="datetime-local" value={f.closes} onChange={(e) => set('closes', e.target.value)} />
        </div>
        <TextInput label={f.kind === 'trip' ? 'Meeting point and time' : 'Pickup place and hours'} value={f.pickup} onChange={(e) => set('pickup', e.target.value)} />
        {f.kind === 'package' && <Check2 label="Offer delivery" checked={f.delivery} onChange={(e) => set('delivery', e.target.checked)} />}
      </section>
      <section className="grid gap-s3">
        <h2 className="tx-heading h3">Questions</h2>
        <p className="text-body-sm text-ink-2">Name, email and phone are filled in from the member’s account. Add anything else you need.</p>
        <FormBuilder value={questions} onChange={setQuestions} />
      </section>
      <section className="tx-card grid gap-s3">
        <Check2 label="Open: members can see it and sign up" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
        <div className="flex flex-wrap gap-s2">
          <Button loading={busy} onClick={save}>Save</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </section>
    </div>
  );
}

function Sales() {
  const [rows, setRows] = useState<SalesRow[] | null>(null);
  useEffect(() => { packagesApi.sales().then(setRows).catch(() => setRows([])); }, []);
  const total = (rows ?? []).reduce((a, r) => a + r.total_egp, 0);
  const byMethod = (m: SalesRow['method']) => (rows ?? []).filter((r) => r.method === m).reduce((a, r) => a + r.total_egp, 0);
  return (
    <div className="grid gap-s4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-s2">
        <div className="tx-card tx-card--red tx-kpi"><span className="tx-label" style={{ color: '#fff' }}>Total sold</span><span className="money">{egp(total)}</span></div>
        {(['instapay', 'telda', 'cash'] as const).map((m) => <div key={m} className="tx-card tx-kpi"><span className="tx-label">{methodName[m]}</span><span className="money">{egp(byMethod(m))}</span></div>)}
      </div>
      {rows === null ? <Skeleton h={160} /> : rows.length === 0 ? <EmptyState title="No sales yet." /> : (
        <>
          <div className="overflow-x-auto"><table className="tx-table">
            <thead><tr><th>Package</th><th>Method</th><th className="tx-amt">Units</th><th className="tx-amt">Total</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.package_id}-${r.method}`}><td className="tx-strong">{r.package}</td><td>{methodName[r.method]}</td><td className="tx-amt">{r.units}</td><td className="tx-amt">{r.total_egp.toLocaleString('en-US')}</td></tr>)}</tbody>
          </table></div>
          <Button small variant="secondary" className="justify-self-start" onClick={() => downloadCsv('package-sales.csv', ['Package', 'Method', 'Orders', 'Units', 'Total EGP'], rows.map((r) => [r.package, methodName[r.method], r.orders, r.units, r.total_egp]))}><Download aria-hidden="true" />Export</Button>
        </>
      )}
      <p className="text-caption text-ink-3">Every approved order is already in the cashbook: InstaPay as bank, Telda as Telda, cash as cash on hand.</p>
    </div>
  );
}
