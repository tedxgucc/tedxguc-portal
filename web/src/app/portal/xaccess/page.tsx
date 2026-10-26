'use client';
// X Access (FR-18), in the portal.
//   Every member → My card (show it at partner places) and Perks
//   Partnerships Executives, Ops Curator, Chairman → Cards (issue, renew, cancel), Partners (perks, PIN, banner), Usage
//   Partnerships Associates → view Cards, Partners and Usage
import { Copy, Link2, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { PhotoPicker } from '@/components/portal/PhotoPicker';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, EmptyState, Modal, Segmented, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { CardPair, CardState, cardUrl, PerkList, ShowCard } from '@/components/XAccess';
import { cairoToday, xaccessApi, type XCard, type XPartner, type XPartnerInput, type XUsage } from '@/lib/api/xaccess';
import { fmtDate, fmtRelative } from '@/lib/format';
import { canManageXAccess, canViewXAccess } from '@/lib/roles';

type Tab = 'card' | 'perks' | 'cards' | 'partners' | 'usage';
const stateOf = (c: XCard) => (c.status === 'cancelled' ? 'cancelled' : c.expires_on < cairoToday() ? 'expired' : 'valid') as 'valid' | 'expired' | 'cancelled';
const plusYear = (from?: string) => { const d = new Date(`${from && from > cairoToday() ? from : cairoToday()}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); };
const nice = (d: string) => fmtDate(`${d}T12:00:00Z`, { year: true });

export default function XAccessPage() {
  const { me } = usePortal();
  const view = canViewXAccess(me);
  const tabs: { value: Tab; label: string }[] = [{ value: 'card', label: 'My card' }, { value: 'perks', label: 'Perks' }];
  if (view) tabs.push({ value: 'cards', label: 'Cards' }, { value: 'partners', label: 'Partners' }, { value: 'usage', label: 'Usage' });
  const [tab, setTab] = useState<Tab>('card');
  return (
    <>
      <PageTitle label={view ? 'X Access · Partnerships' : 'X Access'} title={tabs.find((t) => t.value === tab)!.label} />
      <div className="mb-s5 overflow-x-auto -mx-s4 px-s4 md:mx-0 md:px-0"><div className={view ? 'min-w-[520px] max-w-[680px]' : 'max-w-[320px]'}>
        <Segmented label="X Access view" value={tab} onChange={setTab} options={tabs} />
      </div></div>
      {tab === 'card' && <MyCard />}
      {tab === 'perks' && <Perks />}
      {tab === 'cards' && <Cards />}
      {tab === 'partners' && <Partners />}
      {tab === 'usage' && <Usage />}
    </>
  );
}

function MyCard() {
  const [card, setCard] = useState<XCard | null | undefined>(undefined);
  const [show, setShow] = useState(false);
  useEffect(() => { xaccessApi.myCard().then(setCard).catch(() => setCard(null)); }, []);
  if (card === undefined) return <Skeleton h={240} />;
  if (!card) return <EmptyState title="No card yet">Partnerships issues X Access cards. Ask your Partnerships team for one.</EmptyState>;
  const info = { ...card, status: stateOf(card) };
  return (
    <div className="grid gap-s4 max-w-[760px]">
      <div className="flex flex-wrap items-center gap-s2"><CardState status={info.status} /><span className="text-body-sm text-ink-2">Valid until {nice(card.expires_on)}</span></div>
      <CardPair card={info} code={card.code} onShow={info.status === 'valid' ? () => setShow(true) : undefined} />
      <p className="text-body-sm text-ink-2">At a partner place, tap <b>Show my card</b> and let them scan the QR. See what each partner gives under <b>Perks</b>.</p>
      {show && <ShowCard card={info} code={card.code} onClose={() => setShow(false)} />}
    </div>
  );
}

function Perks() {
  const [perks, setPerks] = useState<XPartner[] | null>(null);
  useEffect(() => { xaccessApi.listPerks().then(setPerks).catch(() => setPerks([])); }, []);
  if (!perks) return <Skeleton h={240} />;
  if (!perks.length) return <EmptyState title="No perks yet">Partner discounts show up here.</EmptyState>;
  return <PerkList perks={perks} />;
}

// ---------------------------------------------------------------- cards
function Cards() {
  const { me, members } = usePortal();
  const toast = useToast();
  const manage = canManageXAccess(me);
  const [cards, setCards] = useState<XCard[] | null>(null);
  const [q, setQ] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [bulk, setBulk] = useState(false);
  const load = useCallback(() => { xaccessApi.listCards().then(setCards).catch(() => setCards([])); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => (cards ?? []).filter((c) => !q.trim() || `${c.holder_name} ${c.number} ${c.holder_email ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())), [cards, q]);
  const without = members.filter((m) => !(cards ?? []).some((c) => c.user_id === m.user_id && c.status === 'active')).length;

  const act = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast('ok', ok); load(); } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };
  const copy = async (c: XCard) => {
    try { await navigator.clipboard.writeText(cardUrl(c.code)); toast('ok', 'Card link copied.', `Send it to ${c.holder_name.split(' ')[0]}; it opens their card.`); }
    catch { toast('warn', 'Couldn’t copy.', cardUrl(c.code)); }
  };

  return (
    <div className="grid gap-s4">
      {manage && (
        <div className="flex flex-wrap gap-s2">
          <Button onClick={() => setIssuing(true)}><Plus aria-hidden="true" />Issue a card</Button>
          <Button variant="secondary" onClick={() => setBulk(true)} disabled={!without}><Users aria-hidden="true" />Cards for all members ({without})</Button>
        </div>
      )}
      <div className="relative w-full sm:w-[360px]">
        <TextInput label="Find a card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, number or email" style={{ paddingLeft: 44 }} />
        <Search size={18} className="absolute left-s4 bottom-[17px] text-ink-3" aria-hidden="true" />
      </div>
      {cards === null ? <Skeleton h={240} /> : shown.length === 0 ? <EmptyState title="No cards yet">Issue cards one by one, or give every member a card at once.</EmptyState> : (
        <ul className="grid gap-s2">
          {shown.map((c) => {
            const st = stateOf(c);
            return (
              <li key={c.id} className="tx-card grid gap-s2">
                <div className="flex flex-wrap items-start justify-between gap-s2">
                  <span className="grid min-w-0">
                    <span className="font-semibold">{c.holder_name}{c.user_id && <span className="text-caption text-ink-3"> · member</span>}</span>
                    <span className="text-caption text-ink-3"><span className="code">{c.number}</span> · {c.tier} · until {nice(c.expires_on)}{c.holder_email ? ` · ${c.holder_email}` : ''}</span>
                  </span>
                  <CardState status={st} />
                </div>
                {manage && (
                  <div className="flex flex-wrap gap-s2">
                    <Button small variant="ghost" onClick={() => copy(c)}><Link2 aria-hidden="true" />Copy card link</Button>
                    {c.status === 'active' && <Button small variant="ghost" onClick={() => act(() => xaccessApi.updateCard(c.id, { expires_on: plusYear(c.expires_on) }), 'Renewed for a year.')}><RefreshCw aria-hidden="true" />Renew</Button>}
                    {c.status === 'active'
                      ? <Button small variant="ghost" onClick={() => act(() => xaccessApi.updateCard(c.id, { status: 'cancelled' }), 'Card cancelled. Partners will see it as cancelled.')}>Cancel card</Button>
                      : <Button small variant="ghost" onClick={() => act(() => xaccessApi.updateCard(c.id, { status: 'active' }), 'Card active again.')}>Reactivate</Button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {issuing && <IssueModal onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); load(); }} />}
      <Modal open={bulk} onClose={() => setBulk(false)} title={`Cards for ${without} members?`}
        actions={<><Button variant="secondary" onClick={() => setBulk(false)}>Cancel</Button>
          <Button onClick={async () => { try { const n = await xaccessApi.issueForMembers(); toast('ok', `${n} cards issued.`, 'Members find them under X Access → My card.'); setBulk(false); load(); } catch (e) { toast('bad', 'That didn’t work.', (e as Error).message); } }}>Issue cards</Button></>}>
        <p className="text-ink-2">Every active member without a card gets one, valid for a year. They see it in the portal under X Access → My card.</p>
      </Modal>
    </div>
  );
}

function IssueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { members } = usePortal();
  const toast = useToast();
  const [who, setWho] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('Member');
  const [expires, setExpires] = useState(plusYear());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: string; code: string } | null>(null);
  const member = members.find((m) => m.user_id === who);
  const issue = async () => {
    const n = member?.name ?? name.trim();
    if (!n) { toast('bad', 'Add the holder’s name.'); return; }
    setBusy(true);
    try { setDone(await xaccessApi.issueCard({ name: n, email: email.trim() || undefined, user_id: member?.user_id ?? null, tier, expires_on: expires })); }
    catch (e) { toast('bad', 'Card not issued.', (e as Error).message); } finally { setBusy(false); }
  };
  if (done) {
    return (
      <Modal open onClose={onDone} title={`Card ${done.number} issued`}
        actions={<><Button variant="secondary" onClick={onDone}>Done</Button>
          <Button onClick={async () => { try { await navigator.clipboard.writeText(cardUrl(done.code)); toast('ok', 'Link copied.'); } catch { toast('warn', 'Copy it from the box.'); } }}><Copy aria-hidden="true" />Copy card link</Button></>}>
        <div className="grid gap-s3">
          <p className="text-ink-2">{member ? `${member.name} sees it in the portal under X Access. ` : ''}Send this private link to the holder; it opens their card with the QR.</p>
          <TextInput label="Card link" value={cardUrl(done.code)} readOnly onFocus={(e) => e.currentTarget.select()} />
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title="Issue an X Access card"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={issue}>Issue card</Button></>}>
      <div className="grid gap-s4">
        <Select label="Holder" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Someone outside the team</option>
          {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </Select>
        {!member && <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
        {!member && <TextInput label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
          <TextInput label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} help="Shown on the card, e.g. Member, Gold." />
          <TextInput label="Valid until" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- partners
const blank = (): XPartnerInput => ({ name: '', logo_url: null, website: null, perk: '', terms: null, expires_on: null, is_active: true, sort_order: 0, in_banner: false, banner_offer: null, promo_code: null, banner_starts: null, banner_ends: null });

function Partners() {
  const { me } = usePortal();
  const manage = canManageXAccess(me);
  const [list, setList] = useState<XPartner[] | null>(null);
  const [edit, setEdit] = useState<XPartnerInput | null>(null);
  const load = useCallback(() => { xaccessApi.listPartners().then(setList).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (edit) return <PartnerEditor value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  return (
    <div className="grid gap-s4">
      {manage && <Button className="justify-self-start" onClick={() => setEdit(blank())}><Plus aria-hidden="true" />Add a partner</Button>}
      {list === null ? <Skeleton h={200} /> : list.length === 0 ? <EmptyState title="No partners yet">Add each partner and the discount they give X Access holders.</EmptyState> : (
        <ul className="grid gap-s2 md:grid-cols-2">
          {list.map((p) => (
            <li key={p.id} className="tx-card grid gap-s2 content-start">
              <div className="flex items-start justify-between gap-s2">
                <span className="grid min-w-0"><span className="font-semibold">{p.name}</span><span className="text-body-sm text-ink-2">{p.perk}</span></span>
                <span className="flex flex-wrap gap-s1 justify-end">
                  {!p.is_active ? <Chip kind="void">Hidden</Chip> : p.expires_on && p.expires_on < cairoToday() ? <Chip kind="pending">Expired</Chip> : <Chip kind="ok">Live</Chip>}
                  {p.in_banner && <Chip kind="soft">Banner</Chip>}
                </span>
              </div>
              {p.expires_on && <span className="text-caption text-ink-3">Until {nice(p.expires_on)}</span>}
              {manage && <Button small variant="secondary" className="justify-self-start" onClick={() => setEdit(p)}>Edit</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PartnerEditor({ value, onClose, onSaved }: { value: XPartnerInput; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(value);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof XPartnerInput>(k: K, v: XPartnerInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim() || !f.perk.trim()) { toast('bad', 'Add the partner’s name and the perk.'); return; }
    if (pin && !/^\d{4,8}$/.test(pin)) { toast('bad', 'The PIN is 4 to 8 digits.'); return; }
    setBusy(true);
    try {
      await xaccessApi.savePartner({ ...f, name: f.name.trim(), perk: f.perk.trim(), terms: f.terms?.trim() || null, website: f.website?.trim() || null });
      if (pin && f.id) await xaccessApi.setPin(f.id, pin);
      toast('ok', 'Partner saved.', !f.id && pin ? 'Open it again to set the PIN.' : undefined);
      onSaved();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-s5 max-w-[760px]">
      <section className="tx-card grid gap-s4">
        <h2 className="tx-heading h3">{f.id ? `Edit ${value.name}` : 'New partner'}</h2>
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="grid gap-s4">
            <TextInput label="Partner name" value={f.name} onChange={(e) => set('name', e.target.value)} />
            <TextInput label="The perk" value={f.perk} onChange={(e) => set('perk', e.target.value)} placeholder="15% off every drink" />
          </div>
          <PhotoPicker label="Logo" url={f.logo_url} folder="partners" onChange={(u) => set('logo_url', u)} />
        </div>
        <TextArea label="Terms (optional)" rows={2} value={f.terms ?? ''} onChange={(e) => set('terms', e.target.value)} placeholder="Dine-in only. Not with other offers." />
        <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
          <TextInput label="Website (optional)" type="url" value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} />
          <TextInput label="Perk ends (optional)" type="date" value={f.expires_on ?? ''} onChange={(e) => set('expires_on', e.target.value || null)} />
        </div>
        <Check2 label="Live: show it on the Perks page" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
      </section>

      <section className="tx-card grid gap-s3">
        <h2 className="tx-heading h3">Partner PIN</h2>
        <p className="text-body-sm text-ink-2">The partner types this PIN on the verify page to log each use, so you can report usage back to them. Leave empty to keep the current PIN.</p>
        {f.id ? <div className="max-w-[240px]"><TextInput label="New PIN (4–8 digits)" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
          : <p className="text-caption text-ink-3">Save the partner first, then set the PIN.</p>}
      </section>

      <section className="tx-card grid gap-s4">
        <h2 className="tx-heading h3">Sponsor banner</h2>
        <Check2 label="Show in the discount banner at the top of the public site" checked={f.in_banner} onChange={(e) => set('in_banner', e.target.checked)} />
        {f.in_banner && (
          <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
            <TextInput label="Big offer text" value={f.banner_offer ?? ''} onChange={(e) => set('banner_offer', e.target.value || null)} placeholder="20% OFF" />
            <TextInput label="Promo code (optional)" value={f.promo_code ?? ''} onChange={(e) => set('promo_code', e.target.value.toUpperCase() || null)} placeholder="TEDX20" />
            <TextInput label="Banner starts" type="date" value={f.banner_starts ?? ''} onChange={(e) => set('banner_starts', e.target.value || null)} />
            <TextInput label="Banner ends" type="date" value={f.banner_ends ?? ''} onChange={(e) => set('banner_ends', e.target.value || null)} />
          </div>
        )}
      </section>
      <div className="flex gap-s2"><Button loading={busy} onClick={save}>Save</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></div>
    </div>
  );
}

// ---------------------------------------------------------------- usage
function Usage() {
  const [rows, setRows] = useState<XUsage[] | null>(null);
  const [partners, setPartners] = useState<XPartner[]>([]);
  useEffect(() => {
    xaccessApi.usage().then(setRows).catch(() => setRows([]));
    xaccessApi.listPartners().then(setPartners).catch(() => {});
  }, []);
  if (!rows) return <Skeleton h={200} />;
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? 'Partner';
  const list = [...rows].sort((a, b) => b.uses - a.uses || b.clicks - a.clicks);
  if (!list.length) return <EmptyState title="No uses logged yet">Uses appear when partners enter their PIN on the verify page.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="tx-table">
        <thead><tr><th>Partner</th><th className="tx-amt">Card uses</th><th>Last use</th><th className="tx-amt">Banner clicks</th></tr></thead>
        <tbody>{list.map((r) => <tr key={r.partner_id}><td className="tx-strong">{name(r.partner_id)}</td><td className="tx-amt">{r.uses}</td><td>{r.last_use ? fmtRelative(r.last_use) : '—'}</td><td className="tx-amt">{r.clicks}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
