// Generates the numbered expense form and memo PDFs for a cash out
// (FR-12.3). POST { transaction_id } with the member's login.
// The member must be able to read the cash out (L&P or finance admins);
// the files are written with the service key because nobody may upload
// to finance/docs/ directly.
import { admin, asUser } from '../_shared/clients.ts';
import { fromDbError, handle, HttpError, json } from '../_shared/http.ts';
import { expenseFormPdf, memoPdf } from '../_shared/finance-pdf.ts';

Deno.serve(handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const db = asUser(req);
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) throw new HttpError(401, 'login_required', 'Please log in again.');
  const { transaction_id } = await req.json().catch(() => ({}));

  // Read as the member: row-level security decides if they may.
  const { data: t, error } = await db.from('transactions')
    .select('id, doc_number, kind, status, occurred_on, item, supplier, description, amount_gross, method, fatora_path, team_id, event_id, expense_request_id, created_by')
    .eq('id', transaction_id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!t) throw new HttpError(404, 'not_found', 'Cash out not found.');
  if (t.kind !== 'cash_out') throw new HttpError(400, 'not_a_cash_out', 'Forms are made for cash outs only.');
  if (t.status === 'void') throw new HttpError(409, 'voided', 'This entry was voided.');

  const [team, event, recorder, request] = await Promise.all([
    t.team_id ? admin.from('teams').select('name').eq('id', t.team_id).maybeSingle() : null,
    t.event_id ? admin.from('events').select('title').eq('id', t.event_id).maybeSingle() : null,
    t.created_by ? admin.from('users').select('name').eq('id', t.created_by).maybeSingle() : null,
    t.expense_request_id
      ? admin.from('expense_requests').select('requested_by, users:requested_by(name)').eq('id', t.expense_request_id).maybeSingle()
      : null,
  ]);

  const details = {
    doc_number: t.doc_number,
    occurred_on: t.occurred_on,
    item: t.item,
    supplier: t.supplier,
    description: t.description,
    amount_gross: t.amount_gross,
    method: t.method,
    team: team?.data?.name ?? null,
    event: event?.data?.title ?? null,
    recorded_by: recorder?.data?.name ?? null,
    // deno-lint-ignore no-explicit-any
    requested_by: (request?.data as any)?.users?.name ?? null,
    has_fatora: Boolean(t.fatora_path),
  };

  const formPath = `docs/${t.id}/expense-form-${t.doc_number}.pdf`;
  const memoPath = `docs/${t.id}/memo-${t.doc_number}.pdf`;
  const [form, memo] = await Promise.all([expenseFormPdf(details), memoPdf(details)]);
  for (const [path, bytes] of [[formPath, form], [memoPath, memo]] as const) {
    const { error: upErr } = await admin.storage.from('finance').upload(path, bytes, {
      contentType: 'application/pdf', upsert: true,
    });
    if (upErr) throw new HttpError(500, 'upload_failed', 'Could not save the PDF. Please try again.');
  }
  const { error: saveErr } = await admin.from('transactions')
    .update({ expense_form_path: formPath, memo_path: memoPath }).eq('id', t.id);
  if (saveErr) throw fromDbError(saveErr);

  const sign = async (path: string) =>
    (await admin.storage.from('finance').createSignedUrl(path, 600)).data?.signedUrl ?? null;
  return json({ expense_form_url: await sign(formPath), memo_url: await sign(memoPath) });
}));
