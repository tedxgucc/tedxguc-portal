'use client';
// Pickup QR scanner, plus the list of extra members allowed to use it
// (like door staff for events).
import { Check, Plus, ScanLine, UserMinus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { QrScanner } from '@/components/QrScanner';
import { useToast } from '@/components/Toast';
import { Avatar, Button, EmptyState, Select, Skeleton, TextInput } from '@/components/ui';
import { packagesApi, type PickupResult } from '@/lib/api/phase2b';
import { roleLabel } from '@/lib/roles';

export function Pickup() {
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

export function PickupScanners() {
  const { members, me } = usePortal();
  const toast = useToast();
  const [ids, setIds] = useState<string[] | null>(null);
  const [pick, setPick] = useState('');
  const load = useCallback(() => { packagesApi.listPickupScanners().then(setIds).catch(() => setIds([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!ids) return <Skeleton h={160} />;
  const staff = ids.map((id) => members.find((m) => m.user_id === id)).filter(Boolean) as typeof members;
  const candidates = members.filter((m) => !ids.includes(m.user_id) && m.user_id !== me.id && m.division_kind !== 'operations' && m.role !== 'chairman').sort((x, y) => x.name.localeCompare(y.name));
  const set = async (userId: string, on: boolean) => {
    try {
      await packagesApi.setPickupScanner(userId, on);
      toast('ok', on ? 'Added to pickup' : 'Removed from pickup', on ? 'They see Pickup scanner in their menu.' : undefined);
      setPick('');
      load();
    } catch (e) { toast('bad', 'Couldn’t update', (e as Error).message); }
  };
  return (
    <section className="grid gap-s4 max-w-[760px]" aria-labelledby="pickup-team">
      <h2 id="pickup-team" className="tx-heading h3">Who can scan pickups</h2>
      <p className="text-ink-2 text-body-sm">Operations and sign-up managers can always scan. Add any other member who hands out orders. Everyone in Operations already sees the Pickup scanner in their menu.</p>
      {staff.length === 0 ? <EmptyState title="No extra scanners">Only Operations and sign-up managers can scan pickups.</EmptyState> : (
        <ul className="grid gap-s2">
          {staff.map((m) => (
            <li key={m.user_id} className="tx-card flex items-center gap-s3">
              <Avatar name={m.name} small />
              <span className="flex-1 min-w-0"><span className="font-semibold">{m.name}</span><span className="caption tx-faint block">{roleLabel[m.role]}{m.team ? ` · ${m.team}` : ''}</span></span>
              <button type="button" className="tx-iconbtn" aria-label={`Remove ${m.name} from pickup`} onClick={() => set(m.user_id, false)}><UserMinus size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length === 0 ? <p className="text-ink-3 text-body-sm">Everyone in the portal can already scan. New members from other divisions will show up here.</p> : <div className="flex flex-wrap items-end gap-s2">
        <div className="w-full sm:w-[320px]">
          <Select label="Add someone" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a member</option>
            {candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.team ? ` · ${m.team}` : ''}</option>)}
          </Select>
        </div>
        <Button disabled={!pick} onClick={() => set(pick, true)}><Plus size={16} aria-hidden="true" />Add to pickup</Button>
      </div>}
    </section>
  );
}
