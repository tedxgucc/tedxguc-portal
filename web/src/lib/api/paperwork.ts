import { expenseFormPdf, memoPdf } from '../finance-pdf';
import type { Transaction } from '../types';

// Demo mode: build the expense form and memo PDFs in the browser.
export async function paperworkBlobs(t: Transaction, extra: { team: string | null; event: string | null; requested_by: string | null; recorded_by: string | null }) {
  const details = {
    doc_number: t.doc_number ?? 'CO-DRAFT', occurred_on: t.occurred_on, item: t.item, supplier: t.supplier, description: t.description,
    amount_gross: t.amount_gross, method: t.method, has_fatora: !!t.fatora_path, ...extra,
  };
  const [form, memo] = await Promise.all([expenseFormPdf(details), memoPdf(details)]);
  const url = (b: Uint8Array) => URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/pdf' }));
  return { expense_form_url: url(form), memo_url: url(memo) };
}

