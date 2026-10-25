// Unit tests for Phase 2 email wording and finance PDFs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { applicationEmail, orderPlacedEmail, orderConfirmedEmail, egp } from '../../supabase/functions/_shared/templates.ts';
import { expenseFormPdf, memoPdf } from '../../supabase/functions/_shared/finance-pdf.ts';

test('application emails: no status link in rejections, team named on acceptance', () => {
  const base = { applicant_name: 'Omar', applicant_email: 'o@x.co', cycle_name: 'Fall 2027' };
  const rej = applicationEmail({ ...base, stage: 'rejected' }, 'https://site/join/status/t');
  assert.doesNotMatch(rej.text, /join\/status/);
  assert.match(rej.text, /apply again/);
  const acc = applicationEmail({ ...base, stage: 'accepted', team: 'Media and Design' });
  assert.match(acc.text, /Welcome to Media and Design/);
  assert.match(applicationEmail({ ...base, stage: 'interview' }, 'u').subject, /Interview/);
});

test('order emails: InstaPay shows link and the order number for the note; cash shows the booth', () => {
  const o = { buyer_name: 'Sara', buyer_email: 's@x.co', order_no: 'PKG-2027-0007', package_name: 'Box', total_egp: '900', payment_link: 'https://ipn.eg/S/tedxguc' };
  const ip = orderPlacedEmail({ ...o, method: 'instapay' }, 'https://site/orders/t');
  assert.match(ip.text, /EGP 900\.00 by InstaPay: https:\/\/ipn\.eg/);
  assert.match(ip.text, /Write PKG-2027-0007 in the transfer note/);
  const cash = orderPlacedEmail({ ...o, method: 'cash', pickup_info: 'Building C' }, 'u');
  assert.match(cash.text, /cash at the TEDxGUC booth \(Building C\)/);
  assert.match(orderConfirmedEmail(o).html, /cid:ticket-qr/);
  assert.equal(egp(12450), 'EGP 12,450.00');
});

test('expense form and memo are valid one-page A4 PDFs', async () => {
  const c = {
    doc_number: 'CO-2027-0042', occurred_on: '2027-03-01', item: 'Gaffer tape', supplier: 'Hardware Co.',
    description: null, amount_gross: '350.5', method: 'cash', team: 'Logistics and Planning',
    event: 'Main Event', requested_by: 'Aya', recorded_by: 'Hamza', has_fatora: false,
  };
  for (const bytes of [await expenseFormPdf(c), await memoPdf(c)]) {
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(pdf.getPage(0).getSize(), { width: 595.28, height: 841.89 });
    assert.match(pdf.getTitle() ?? '', /CO-2027-0042/);
  }
});
