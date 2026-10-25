'use client';
// Inquiry inbox (FR-1.6). Partner leads go to the Operations leads and the
// Partnerships team; contact messages go to the Chairman and Curators.
import { Check, Mail, Phone, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { adminApi, type Inquiry } from '@/lib/api/admin';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { canOpenInbox, seesContactInquiries, seesPartnerInquiries } from '@/lib/roles';

type Kind = 'all' | 'partner' | 'contact';
type Status = 'new' | 'handled';

export default function InboxPage() {
  const { me, memberName } = usePortal();
  const toast = useToast();
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const both = seesPartnerInquiries(me) && seesContactInquiries(me);
  const [kind, setKind] = useState<Kind>('all');
  const [status, setStatus] = useState<Status>('new');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => { adminApi.listInquiries().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!canOpenInbox(me)) return <EmptyState title="Not your inbox">Partner leads go to Operations and Partnerships; contact messages go to the Chairman and Curators.</EmptyState>;
  if (!rows) return <Skeleton h={300} />;

  const shown = rows.filter((r) => r.status === status && (kind === 'all' || r.kind === kind));
  const newCount = rows.filter((r) => r.status === 'new').length;
  const mark = async (r: Inquiry, handled: boolean) => {
    setBusy(r.id);
    try {
      await adminApi.markInquiry(r.id, handled);
      toast('ok', handled ? 'Marked handled' : 'Moved back to new');
      load();
    } catch (e) {
      toast('bad', 'Couldn’t update', (e as Error).message);
    } finally { setBusy(null); }
  };
  const subject = (r: Inquiry) => encodeURIComponent(r.kind === 'partner' ? `TEDxGUC partnership${r.company ? ` · ${r.company}` : ''}` : 'Your message to TEDxGUC');

  return (
    <>
      <PageTitle label={both ? 'Inbox' : seesPartnerInquiries(me) ? 'Inbox · Partner leads' : 'Inbox · Contact'} count={newCount} title="Messages" />
      <div className="flex flex-wrap gap-s3 mb-s5">
        <div className="w-full sm:w-[260px]"><Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'new', label: `New (${newCount})` }, { value: 'handled', label: 'Handled' }]} /></div>
        {both && <div className="w-full sm:w-[340px]"><Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'partner', label: 'Partners' }, { value: 'contact', label: 'Contact' }]} /></div>}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={status === 'new' ? 'All caught up' : 'Nothing handled yet'}>{status === 'new' ? 'New messages from the website land here.' : 'Messages you mark handled move here.'}</EmptyState>
      ) : (
        <ul className="grid gap-s3 max-w-[820px]">
          {shown.map((r) => (
            <li key={r.id} className="tx-card grid gap-s3">
              <div className="flex flex-wrap items-start justify-between gap-s2">
                <div className="grid gap-s1 min-w-0">
                  <span className="font-semibold">{r.name}{r.company ? <span className="text-ink-2"> · {r.company}</span> : null}</span>
                  <span className="caption tx-faint" title={fmtDateTime(r.created_at)}>{fmtRelative(r.created_at)}</span>
                </div>
                <Chip kind={r.kind === 'partner' ? 'pending' : 'soft'}>{r.kind === 'partner' ? 'Partner lead' : 'Contact'}</Chip>
              </div>
              <p className="whitespace-pre-line">{r.message}</p>
              <div className="flex flex-wrap items-center gap-x-s4 gap-y-s1 text-body-sm">
                <a href={`mailto:${r.email}?subject=${subject(r)}`} className="inline-flex items-center gap-s1 break-all"><Mail size={16} aria-hidden="true" />{r.email}</a>
                {r.phone && <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-s1"><Phone size={16} aria-hidden="true" />{r.phone}</a>}
              </div>
              <div className="flex flex-wrap items-center gap-s2">
                {r.status === 'new' ? (
                  <Button small loading={busy === r.id} onClick={() => mark(r, true)}><Check size={16} aria-hidden="true" />Mark handled</Button>
                ) : (
                  <>
                    <span className="caption tx-faint">Handled by {r.handled_by ? memberName(r.handled_by) : 'someone'}</span>
                    <Button small variant="ghost" loading={busy === r.id} onClick={() => mark(r, false)}><RotateCcw size={16} aria-hidden="true" />Reopen</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
