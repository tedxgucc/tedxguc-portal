'use client';
// Partner verify page (FR-18.3, FR-18.4): opened by scanning a card's QR.
// Shows valid / expired and the holder's first name only. The partner can
// log the use with their PIN. Partners need no account.
import { Check, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Select, TextInput } from '@/components/ui';
import { xaccessApi, type XRedeem } from '@/lib/api/xaccess';
import { fmtDate } from '@/lib/format';
import { PageLoading, useLoad } from '@/lib/useLoad';

const problem: Record<NonNullable<XRedeem['error']>, string> = {
  wrong_pin: 'That PIN isn’t right for this partner.',
  too_many_tries: 'Too many tries. Wait a while, then try again.',
  card_not_found: 'This card doesn’t exist.',
  card_not_valid: 'This card isn’t valid, so the use wasn’t logged.',
};

function VerifyInner() {
  const code = useSearchParams().get('c') ?? '';
  const toast = useToast();
  const data = useLoad(async () => {
    const [v, perks] = await Promise.all([xaccessApi.verify(code), xaccessApi.listPerks()]);
    return { v, perks };
  }, [code]);
  const [partner, setPartner] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  if (!data) return <PageLoading />;
  const { v, perks } = data;
  const ok = v.status === 'valid';
  const title = ok ? 'Valid card' : v.status === 'expired' ? 'Card expired' : v.status === 'cancelled' ? 'Card cancelled' : 'Not an X Access card';

  const redeem = async () => {
    if (!partner) { toast('bad', 'Pick your place first.'); return; }
    setBusy(true);
    try {
      const r = await xaccessApi.redeem(code, partner, pin);
      if (r.ok) { setLogged(r.partner ?? ''); setPin(''); }
      else toast('bad', 'Not logged.', problem[r.error ?? 'wrong_pin']);
    } catch (e) { toast('bad', 'Not logged.', (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[560px] px-s4 pt-s7 grid gap-s5">
      <span className="tx-label">X Access · Partner check</span>
      <div className="tx-checkin py-s5" role="status">
        <div className={`tx-checkin__stamp ${ok ? '' : v.status === 'expired' ? 'is-warn' : 'is-bad'}`}>{ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}</div>
        <div className="tx-checkin__t">{title}</div>
        {v.first_name && <p className="text-ink-2 text-center">{v.first_name}{v.number ? ` · ${v.number}` : ''}{v.expires_on ? ` · until ${fmtDate(`${v.expires_on}T12:00:00Z`, { year: true })}` : ''}</p>}
        {ok && <p className="text-body-sm text-ink-3 text-center">Give the X Access perk.</p>}
      </div>

      {ok && perks.length > 0 && (
        <section className="tx-card grid gap-s4" aria-labelledby="log">
          <h2 id="log" className="tx-heading h3">Log this use</h2>
          {logged !== null ? (
            <p className="flex items-center gap-s2"><Check size={18} className="text-ok" aria-hidden="true" />Logged for {logged}. Thank you!</p>
          ) : (
            <>
              <p className="text-body-sm text-ink-2">Optional: pick your place and enter the PIN TEDxGUC gave you. It helps us report how many people you served.</p>
              <Select label="Your place" value={partner} onChange={(e) => setPartner(e.target.value)}>
                <option value="">Choose</option>
                {perks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <TextInput label="PIN" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
              <Button onClick={redeem} loading={busy} disabled={pin.length < 4}>Log use</Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default function XAccessVerifyPage() {
  return <Suspense><VerifyInner /></Suspense>;
}
