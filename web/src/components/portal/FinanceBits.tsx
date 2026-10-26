'use client';
// Shared finance pieces: money formatting, status chips, upload button,
// paperwork links. Money format from the design system: "EGP 1,250.00",
// a true minus sign for money out.
import { FileText, Receipt, ScrollText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Chip } from '@/components/ui';
import { egp } from '@/lib/format';
import type { ExpenseStatus, Transaction } from '@/lib/types';

export function Money({ value, sign = false, className = '' }: { value: number; sign?: boolean; className?: string }) {
  return <span className={`tabular-nums whitespace-nowrap ${className}`}>{sign && value > 0 ? '+ ' : ''}{egp(value)}</span>;
}

export const signed = (t: Transaction) => (t.direction === 'in' ? t.amount_net : -t.amount_net);

export const kindLabel: Record<Transaction['kind'], string> = {
  cash_out: 'Cash out', bank_deposit: 'Bank deposit', sponsorship: 'Sponsorship', package_sale: 'Package sale', refund: 'Refund', opening_balance: 'Bank statement', bank_out: 'Bank out',
};
export const methodLabel: Record<Transaction['method'], string> = { cash: 'Cash', bank: 'Bank', instapay: 'InstaPay', telda: 'Telda' };

export function RequestChip({ status }: { status: ExpenseStatus }) {
  switch (status) {
    case 'submitted': return <Chip kind="pending">Waiting for curator</Chip>;
    case 'awaiting_chairman': return <Chip kind="pending">Waiting for chairman</Chip>;
    case 'approved': return <Chip kind="ok">Approved</Chip>;
    case 'purchased': return <Chip kind="ok">Bought</Chip>;
    case 'rejected': return <Chip kind="bad">Rejected</Chip>;
    case 'cancelled': return <Chip kind="void">Cancelled</Chip>;
  }
}

export function FatoraChip({ t }: { t: Transaction }) {
  if (t.kind !== 'cash_out') return null;
  return t.fatora_path ? <Chip kind="ok">Fatora</Chip> : <Chip kind="bad">No fatora</Chip>;
}

// Upload a fatora photo or PDF (design system: UploadArea, compact).
export function FatoraUpload({ onFile, label = 'Upload fatora' }: { onFile: (f: File) => Promise<void>; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) { toast('bad', 'That file is too big.', 'Upload a photo or PDF under 10 MB.'); return; }
          setBusy(true);
          try { await onFile(f); toast('ok', 'Fatora uploaded.'); } catch (x) { toast('bad', 'That didn’t upload.', (x as Error).message); } finally { setBusy(false); }
        }} />
      <Button small variant="secondary" loading={busy} onClick={() => ref.current?.click()}><Upload aria-hidden="true" />{label}</Button>
    </>
  );
}

export function UploadArea({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="tx-file">
          <div className="tx-file__thumb"><Receipt aria-hidden="true" /></div>
          <div className="min-w-0"><div className="font-semibold truncate text-body-sm">{file.name}</div><div className="text-caption text-ink-3">{Math.round(file.size / 1024)} KB</div></div>
          <button type="button" className="tx-link text-caption bg-transparent border-0 cursor-pointer" onClick={() => onPick(null)}>Remove</button>
        </div>
      ) : (
        <button type="button" className={`tx-upload w-full ${over ? 'is-over' : ''}`} onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0] ?? null); }}>
          <Receipt aria-hidden="true" />
          <span className="tx-upload__t">Add the fatora</span>
          <span className="tx-upload__d">Photo or PDF, up to 10 MB. Entries without one are flagged.</span>
        </button>
      )}
    </div>
  );
}

export function PaperworkLinks({ urls }: { urls: { expense_form_url: string | null; memo_url: string | null } }) {
  return (
    <div className="flex flex-wrap gap-s2">
      {urls.expense_form_url && <a className="tx-btn tx-btn--secondary tx-btn--sm" href={urls.expense_form_url} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Expense form</a>}
      {urls.memo_url && <a className="tx-btn tx-btn--secondary tx-btn--sm" href={urls.memo_url} target="_blank" rel="noopener noreferrer"><ScrollText aria-hidden="true" />Memo</a>}
    </div>
  );
}

export function downloadCsv(name: string, head: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [head.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}
