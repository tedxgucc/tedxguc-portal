// Finance: who sees money, expense approvals, VAT, voiding, balances.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, opsCurator, mktCurator, lpExec, lpAssoc, pExec, mediaExec, mediaAssoc;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  opsCurator = await db.member('curator', 'operations');
  mktCurator = await db.member('curator', 'marketing');
  lpExec = await db.member('executive', 'logistics_planning');
  lpAssoc = await db.member('associate', 'logistics_planning');
  pExec = await db.member('executive', 'partnerships');
  mediaExec = await db.member('executive', 'media_design');
  mediaAssoc = await db.member('associate', 'media_design');
  const marketing = await db.division('marketing');
  await db.as(chairman, ({ q }) => q(`insert into division_budgets (division_id, amount_egp) values ($1, 20000)`, [marketing]));
});

const cashOut = (who, amount, extra = {}) =>
  db.as(who, ({ one }) => one(
    `insert into transactions (kind, method, amount_gross, item, supplier, team_id, expense_request_id, fatora_path)
     values ('cash_out', 'cash', $1, $2, 'Supplier', $3, $4, $5) returning *`,
    [amount, extra.item ?? 'Tape', extra.team ?? null, extra.request ?? null, extra.fatora ?? null]));

test('L&P records cash outs with numbered entries; Associates and other teams cannot (FR-12.2)', async () => {
  const t = await cashOut(lpExec, 150, { fatora: 'fatora/x/a.jpg' });
  assert.equal(t.doc_number, 'CO-2027-0001');
  assert.equal(t.direction, 'out');
  assert.equal(Number(t.amount_net), 150);
  await rejects(cashOut(lpAssoc, 10), /row-level security/);
  await rejects(cashOut(mediaExec, 10), /row-level security/);
  await rejects(cashOut(pExec, 10), /row-level security/);
});

test('Partnerships records deposits net of 14% VAT; L&P cannot see them (FR-12.4)', async () => {
  const d = await db.as(pExec, ({ one }) => one(
    `insert into transactions (kind, method, amount_gross, description) values ('bank_deposit', 'bank', 11400, 'Sponsor X') returning *`));
  assert.equal(Number(d.vat_amount), 1400);
  assert.equal(Number(d.amount_net), 10000);
  assert.equal(d.account, 'bank');
  const lpSees = await db.as(lpExec, ({ q }) => q(`select kind from transactions`));
  assert.ok(lpSees.every((r) => r.kind === 'cash_out'));
  const pSees = await db.as(pExec, ({ q }) => q(`select kind from transactions`));
  assert.ok(pSees.every((r) => r.kind !== 'cash_out'));
  await rejects(db.as(pExec, ({ q }) => q(`insert into transactions (kind, method, amount_gross) values ('package_sale', 'cash', 5)`)), /row-level security/);
});

test('nobody outside finance sees money or balances (FR-12.7)', async () => {
  for (const who of [mktCurator, mediaExec, mediaAssoc, lpAssoc]) {
    assert.equal((await db.as(who, ({ q }) => q(`select 1 from transactions`))).length, 0);
    await rejects(db.as(who, ({ q }) => q(`select finance_balances()`)), /not_allowed/);
  }
  await rejects(db.as(lpExec, ({ q }) => q(`select finance_balances()`)), /not_allowed/);
  await rejects(db.as('anon', ({ q }) => q(`select * from transactions`)), /permission denied/);
});

test('balances per account, for the Operations Curator and the Chairman (FR-12.5, FR-12.6)', async () => {
  const b = await db.as(opsCurator, ({ one }) => one(`select finance_balances() as b`)).then((x) => x.b);
  assert.equal(Number(b.bank), 10000);
  assert.equal(Number(b.cash), -150);
  assert.equal(Number(b.vat_collected), 1400);
  assert.equal(Number(b.cash_outs_missing_fatora), 0);
  const c = await db.as(chairman, ({ one }) => one(`select finance_balances() as b`)).then((x) => x.b);
  assert.deepEqual(c, b);
});

test('a cash out without a fatora is flagged', async () => {
  await cashOut(lpExec, 20);
  const b = await db.as(opsCurator, ({ one }) => one(`select finance_balances() as b`)).then((x) => x.b);
  assert.equal(Number(b.cash_outs_missing_fatora), 1);
});

test('money requests: only L&P Executives ask; only Ops leads see and decide', async () => {
  const media = await db.team('media_design');
  const lp = await db.team('logistics_planning');
  const ask = (who, team, item, amount) => db.as(who, ({ one }) => one(
    `insert into expense_requests (team_id, item, amount_egp) values ($1, $2, $3) returning id`, [team, item, amount]));
  await rejects(ask(mediaAssoc, media, 'x', 5), /row-level security/);
  await rejects(ask(mediaExec, media, 'x', 5), /row-level security/);
  await rejects(ask(lpAssoc, lp, 'x', 5), /row-level security/);
  const r = await ask(lpExec, lp, 'Camera batteries', 900);
  const sees = async (who) => (await db.as(who, ({ q }) => q(`select 1 from expense_requests where id = $1`, [r.id]))).length;
  assert.equal(await sees(mktCurator), 0);
  assert.equal(await sees(opsCurator), 1);
  assert.equal(await sees(chairman), 1);
  await rejects(db.as(mktCurator, ({ q }) => q(`select decide_expense_request($1, true)`, [r.id])), /not_allowed/);
  const d = await db.as(opsCurator, ({ one }) => one(`select decide_expense_request($1, true) as r`, [r.id])).then((x) => x.r);
  assert.equal(d.status, 'approved');
  const t = await cashOut(lpExec, 880, { request: r.id });
  const req = await db.as(lpExec, ({ one }) => one(`select status, transaction_id from expense_requests where id = $1`, [r.id]));
  assert.equal(req.status, 'purchased');
  assert.equal(req.transaction_id, t.id);
});

test('money request over EGP 5,000 also needs the Chairman', async () => {
  const lp = await db.team('logistics_planning');
  const r = await db.as(lpExec, ({ one }) => one(
    `insert into expense_requests (team_id, item, amount_egp) values ($1, 'Stage screen', 12000) returning id`, [lp]));
  const first = await db.as(opsCurator, ({ one }) => one(`select decide_expense_request($1, true) as r`, [r.id])).then((x) => x.r);
  assert.equal(first.status, 'awaiting_chairman');
  await rejects(db.as(opsCurator, ({ q }) => q(`select decide_expense_request($1, true)`, [r.id])), /not_allowed/);
  const second = await db.as(chairman, ({ one }) => one(`select decide_expense_request($1, false, 'Too expensive') as r`, [r.id])).then((x) => x.r);
  assert.equal(second.status, 'rejected');
  const n = await db.as(lpExec, ({ one }) => one(`select body from notifications where type = 'expense_rejected'`));
  assert.equal(n.body, 'Too expensive');
});

test('no hard delete; voiding needs a reason, locks the entry and reopens its request (FR-12.8)', async () => {
  const lp = await db.team('logistics_planning');
  const r = await db.as(lpExec, ({ one }) => one(
    `insert into expense_requests (team_id, item, amount_egp) values ($1, 'Gaffer tape', 300) returning id`, [lp]));
  await db.as(opsCurator, ({ q }) => q(`select decide_expense_request($1, true)`, [r.id]));
  const t = await cashOut(lpExec, 300, { request: r.id });

  await rejects(db.as(opsCurator, ({ q }) => q(`delete from transactions where id = $1`, [t.id])), /permission denied/);
  await rejects(db.as(opsCurator, ({ q }) => q(`update transactions set status = 'void' where id = $1`, [t.id])), /permission denied/);
  await rejects(db.as(lpExec, ({ q }) => q(`select void_transaction($1, '  ')`, [t.id])), /reason_required/);
  await rejects(db.as(mktCurator, ({ q }) => q(`select void_transaction($1, 'x')`, [t.id])), /not_allowed/);
  await db.as(lpExec, ({ q }) => q(`select void_transaction($1, 'Entered twice')`, [t.id]));
  await rejects(db.as(lpExec, ({ q }) => q(`update transactions set amount_gross = 1 where id = $1`, [t.id])), /voided_entry_locked/);
  const req = await db.as(lpExec, ({ one }) => one(`select status from expense_requests where id = $1`, [r.id]));
  assert.equal(req.status, 'approved');

  const log = await db.as(chairman, ({ q }) => q(
    `select action from audit_log where target_type = 'transactions' and target_id = $1 order by id`, [t.id]));
  assert.deepEqual(log.map((l) => l.action), ['insert', 'update']);
});

test('people cannot forge generated documents or numbers', async () => {
  const t = await db.as(lpExec, ({ one }) => one(
    `insert into transactions (kind, method, amount_gross, doc_number, expense_form_path) values ('cash_out', 'cash', 5, 'CO-1999-9999', 'fake.pdf') returning doc_number, expense_form_path`));
  assert.notEqual(t.doc_number, 'CO-1999-9999');
  assert.equal(t.expense_form_path, null);
});

test('sponsorships: Partnerships manages approvals; decision is stamped', async () => {
  const s = await db.as(pExec, ({ one }) => one(
    `insert into sponsorships (sponsor_name, tier, amount_egp) values ('Acme Bank', 'Gold', 50000) returning id`));
  await db.as(pExec, ({ q }) => q(`update sponsorships set status = 'approved' where id = $1`, [s.id]));
  const row = await db.as(opsCurator, ({ one }) => one(`select status, decided_by from sponsorships where id = $1`, [s.id]));
  assert.deepEqual(row, { status: 'approved', decided_by: pExec });
  assert.equal((await db.as(lpExec, ({ q }) => q(`select 1 from sponsorships`))).length, 0);
});

test('monthly reconciliation shows the difference (FR-12.11)', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await db.as(opsCurator, ({ one }) => one(`select record_reconciliation($1, 'bank', 9950) as r`, [today])).then((x) => x.r);
  assert.equal(Number(r.book_balance), 10000);
  assert.equal(Number(r.difference), -50);
  await rejects(db.as(lpExec, ({ q }) => q(`select record_reconciliation($1, 'bank', 1)`, [today])), /not_allowed/);
});

test('finance files: fatoras for L&P, contracts for Partnerships, quotes for the requester', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const up = (who, path) => db.as(who, ({ q }) => q(`insert into storage.objects (bucket_id, name) values ('finance', $1)`, [path]));
  await up(lpExec, `fatora/${id}/f.jpg`);
  await rejects(up(pExec, `fatora/${id}/f2.jpg`), /row-level security/);
  await up(pExec, `contracts/${id}/c.pdf`);
  await rejects(up(lpExec, `docs/${id}/form.pdf`), /row-level security/);
  const lpView = await db.as(lpExec, ({ q }) => q(`select name from storage.objects where bucket_id = 'finance'`));
  assert.deepEqual(lpView.map((r) => r.name), [`fatora/${id}/f.jpg`]);
});

test('season rollover carries balances as opening entries (FR-3.4)', async () => {
  const fresh = await createDb();
  const chair = await fresh.member('chairman');
  const lp = await fresh.member('executive', 'logistics_planning');
  await fresh.as(chair, ({ q }) => q(`insert into transactions (kind, method, amount_gross) values ('bank_deposit', 'bank', 1140)`)).catch(() => {});
  await fresh.as(lp, ({ q }) => q(`insert into transactions (kind, method, amount_gross) values ('cash_out', 'cash', 50)`));
  const next = await fresh.as(chair, ({ one }) => one(`insert into seasons (year) values (2028) returning id`));
  await fresh.as(chair, ({ q }) => q(`insert into memberships (user_id, season_id, role) values ($1, $2, 'chairman')`, [chair, next.id]));
  await fresh.as(chair, ({ q }) => q(`select activate_season($1)`, [next.id]));
  const ob = await fresh.q(`select account, direction, amount_net, doc_number from transactions where kind = 'opening_balance' order by account`);
  assert.deepEqual(ob.map((r) => [r.account, r.direction, Number(r.amount_net)]), [['cash', 'out', 50], ['bank', 'in', 1000]]);
  assert.match(ob[0].doc_number, /^OB-2028-/);
});

test('bank out: finance admins only, always from the bank, no VAT; bank in can skip VAT', async () => {
  const out = await db.as(opsCurator, ({ one }) => one(
    `insert into transactions (kind, method, amount_gross, description, created_by) values ('bank_out', 'cash', 1200, 'Bank fees', auth.uid()) returning *`));
  assert.equal(out.direction, 'out');
  assert.equal(out.account, 'bank');
  assert.equal(Number(out.vat_amount), 0);
  assert.match(out.doc_number, /^BO-/);
  await rejects(db.as(pExec, ({ q }) => q(`insert into transactions (kind, method, amount_gross, created_by) values ('bank_out', 'bank', 5, auth.uid())`)), /row-level security/);
  await rejects(db.as(lpExec, ({ q }) => q(`insert into transactions (kind, method, amount_gross, created_by) values ('bank_out', 'bank', 5, auth.uid())`)), /row-level security/);
  const inn = await db.as(pExec, ({ one }) => one(
    `insert into transactions (kind, method, amount_gross, vat_applies, description, created_by) values ('bank_deposit', 'bank', 1000, false, 'Transfer from GUC', auth.uid()) returning *`));
  assert.equal(Number(inn.amount_net), 1000);
});
