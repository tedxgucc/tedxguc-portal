'use client';
// A member fills in one sign-up: the manager's questions, then payment
// (InstaPay, Telda or cash) when it isn't free.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { FormFill, missingAnswers } from '@/components/portal/FormBuilder';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { packagesApi } from '@/lib/api/phase2b';
import { egp } from '@/lib/format';
import { kindLabel } from '@/lib/signups';
import type { FormAnswer, OrderMethod, Package } from '@/lib/types';

function SignUpFormInner() {
  const id = useSearchParams().get('id') ?? '';
  const { me } = usePortal();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Package | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, FormAnswer>>({});
  const [phone, setPhone] = useState('+20 ');
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<OrderMethod>('instapay');
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { packagesApi.listPackages().then((l) => setP(l.find((x) => x.id === id && x.is_active) ?? null)).catch(() => setP(null)); }, [id]);

  if (p === undefined) return <Skeleton h={400} />;
  if (p === null) return <EmptyState title="This sign-up is closed." action={<Link href="/portal/signups" className="tx-btn tx-btn--secondary">All sign-ups</Link>} />;
  const free = p.price_egp === 0;
  const max = Math.max(Math.min(p.max_per_order, p.stock_left), 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = missingAnswers(p.questions ?? [], answers);
    if (phone.replace(/\D/g, '').length < 10) err.phone = 'Enter your phone number.';
    if (fulfilment === 'delivery' && !address.trim()) err.address = 'Add the delivery address.';
    setErrors(err);
    if (Object.keys(err).length) { toast('bad', 'Some answers are missing.'); return; }
    setBusy(true);
    try {
      const r = await packagesApi.signUp({ package_id: p.id, phone: phone.trim(), quantity: qty, method: free ? 'cash' : method, fulfilment, address: address.trim() || undefined, answers });
      if (free) { toast('ok', 'You’re signed up.', p.pickup_info ?? undefined); router.push('/portal/signups'); }
      else router.push(`/portal/signups/order?t=${r.status_token}&new=1`);
    } catch (x) {
      toast('bad', 'That didn’t go through.', (x as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle label={kindLabel[p.kind ?? 'package']} title={p.name} />
      <form className="grid gap-s5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start max-w-[1000px]" onSubmit={submit} noValidate>
        <div className="tx-card grid gap-s4">
          {p.description && <p className="text-ink-2">{p.description}</p>}
          <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
            <TextInput label="Name" value={me.name} disabled />
            <TextInput label="Email" value={me.email} disabled />
          </div>
          <TextInput label="Phone / WhatsApp *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" error={errors.phone} />
          <FormFill questions={p.questions ?? []} value={answers} onChange={setAnswers} errors={errors} />
          {p.max_per_order > 1 && (
            <Select label="How many" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          )}
          {p.allows_delivery && (
            <>
              <div className="grid gap-s2"><span className="tx-label">Pickup or delivery</span>
                <Segmented label="Pickup or delivery" value={fulfilment} onChange={setFulfilment} options={[{ value: 'pickup', label: 'Pickup' }, { value: 'delivery', label: 'Delivery' }]} /></div>
              {fulfilment === 'delivery' && <TextArea label="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} rows={2} />}
            </>
          )}
          {!free && (
            <div className="grid gap-s2"><span className="tx-label">Pay by</span>
              <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ value: 'instapay', label: 'InstaPay' }, { value: 'telda', label: 'Telda' }, { value: 'cash', label: 'Cash' }]} />
              <p className="text-caption text-ink-3">{method === 'cash' ? 'We hold your place for 3 days. Pay at the TEDxGUC booth.' : 'Next you’ll see the transfer link and your number for the transfer note, then upload the screenshot.'}</p>
            </div>
          )}
        </div>
        <aside className="tx-card grid gap-s3 lg:sticky lg:top-[88px]">
          <div className="tx-label">Summary</div>
          {p.contents.length > 0 && <ul className="tx-stars text-body-sm">{p.contents.map((c) => <li key={c}>{c}</li>)}</ul>}
          <div className="flex justify-between items-end border-t border-line pt-s3"><span className="tx-label">Total</span><span className="money">{free ? 'Free' : egp(p.price_egp * qty)}</span></div>
          <Button type="submit" block loading={busy} disabled={p.stock_left < 1}>{free ? 'Sign me up' : method === 'cash' ? 'Reserve my place' : `Continue to pay ${egp(p.price_egp * qty)}`}</Button>
          {p.pickup_info && <p className="text-caption text-ink-3">{p.kind === 'trip' ? 'Meeting point' : 'Pickup'}: {p.pickup_info}</p>}
        </aside>
      </form>
    </>
  );
}

export default function SignUpForm() {
  return <Suspense><SignUpFormInner /></Suspense>;
}
