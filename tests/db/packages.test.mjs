// Package sales: ordering, stock, payment approval, cashbook, pickup, refunds.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, rejects } from './harness.mjs';

let db, chairman, opsCurator, lpAssoc, pAssoc, mediaExec, pkg;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  opsCurator = await db.member('curator', 'operations');
  lpAssoc = await db.member('associate', 'logistics_planning');
  pAssoc = await db.member('associate', 'partnerships');
  mediaExec = await db.member('executive', 'media_design');
  await db.q(`update settings set value = '"https://ipn.eg/S/tedxguc"' where key = 'instapay_link'`);
  await db.q(`insert into settings (season_id, key, value) select id, 'instapay_link', '"https://ipn.eg/S/tedxguc"' from seasons where is_active on conflict do nothing`);
  pkg = await db.as(opsCurator, ({ one }) => one(
    `insert into packages (name, price_egp, stock, max_per_order, is_active, pickup_info) values ('Mid-year box', 450, 5, 3, true, 'Booth, Building C') returning *`));
  await db.as(chairman, ({ q }) => q("insert into signup_pickup_scanners (package_id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [pkg.id, lpAssoc]));
});

const order = (email, qty, method = 'instapay') =>
  db.as('service', ({ one }) => one(
    `select place_order($1, 'Buyer', $2, '01012345678', $3, $4) as r`, [pkg.id, email, qty, method])).then((x) => x.r);
const stock = () => db.as(opsCurator, ({ one }) => one(`select package_stock($1) as s`, [pkg.id])).then((x) => x.s);

test('sign-ups are members only; guests see nothing (FR-16.1)', async () => {
  const guest = await db.as('anon', ({ q }) => q(`select name from packages`)).catch(() => []);
  assert.equal(guest.length, 0);
  const rows = await db.as(lpAssoc, ({ q }) => q(`select name from packages`));
  assert.deepEqual(rows.map((r) => r.name), ['Mid-year box']);
  assert.equal(await stock(), 5);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into packages (name, price_egp, stock) values ('x', 1, 1)`)), /row-level security/);
});

test('InstaPay order: amount, order number, payment link; stock held (FR-16.2, FR-16.3)', async () => {
  const o = await order('a@x.co', 2);
  assert.equal(o.order_no, 'PKG-2027-0001');
  assert.equal(Number(o.total_egp), 900);
  assert.equal(o.status, 'pending_proof');
  assert.equal(o.payment_link, 'https://ipn.eg/S/tedxguc');
  assert.equal(await stock(), 3);
  await rejects(order('b@x.co', 4), /invalid_quantity/);
  await rejects(db.as('anon', ({ q }) => q(`select place_order($1, 'x', 'x@y.co', '0101234567', 1, 'cash')`, [pkg.id])), /permission denied/);
});

test('proof → approval → confirmed with pickup QR without a bank entry (FR-16.5, FR-16.7, FR-16.8)', async () => {
  const o = await order('pay@x.co', 1);
  await rejects(db.as('service', ({ q }) => q(`select submit_payment_proof($1, 'evil/path.png')`, [o.status_token])), /invalid_proof/);
  await db.as('service', ({ q }) => q(`select submit_payment_proof($1, $2, 'REF123')`,
    [o.status_token, 'proofs/0b1e4c4e-1111-4222-8333-444455556666.jpg']));
  const pending = await db.as('anon', ({ one }) => one(`select get_order_by_token($1) as r`, [o.status_token])).then((x) => x.r);
  assert.equal(pending.status, 'pending_approval');
  assert.equal((await db.as(opsCurator, ({ q }) => q(`select 1 from notifications where type = 'order_to_approve'`))).length, 1);

  await rejects(db.as(lpAssoc, ({ q }) => q(`select decide_order($1, true)`, [o.order_id])), /not_allowed/);
  const done = await db.as(opsCurator, ({ one }) => one(`select decide_order($1, true) as r`, [o.order_id])).then((x) => x.r);
  assert.match(done.pickup_code, /^[0-9a-f]{32}$/);
  const status = await db.as('anon', ({ one }) => one(`select get_order_by_token($1) as r`, [o.status_token])).then((x) => x.r);
  assert.equal(status.status, 'approved');
  assert.equal(status.pickup_code, done.pickup_code);

  const txn = await db.as(opsCurator, ({ one }) => one(`select kind, account, amount_net from transactions where order_id = $1`, [o.order_id]));
  assert.equal(txn, undefined);
  const links = await db.one(`select transaction_id, refund_transaction_id from orders where id = $1`, [o.order_id]);
  assert.equal(links.transaction_id, null);
  assert.equal(links.refund_transaction_id, null);
});

test('assigned Operations members can approve; members outside Operations cannot be assigned', async () => {
  await rejects(db.as(opsCurator, ({ q }) => q(`insert into package_approvers (user_id) values ($1)`, [mediaExec])), /approver_must_be_in_operations/);
  await db.as(opsCurator, ({ q }) => q(`insert into package_approvers (user_id) values ($1)`, [pAssoc]));
  const o = await order('assigned@x.co', 1, 'telda');
  await db.as('service', ({ q }) => q(`select submit_payment_proof($1, null, 'TELDA-99')`, [o.status_token]));
  const r = await db.as(pAssoc, ({ one }) => one(`select decide_order($1, false, 'No transfer found') as r`, [o.order_id])).then((x) => x.r);
  assert.equal(r.status, 'rejected');
  assert.equal((await db.as(pAssoc, ({ q }) => q(`select 1 from orders`))).length >= 1, true);
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select 1 from orders`))).length, 0);
});

test('cash: reserved and paid at the booth without a bank entry (FR-16.6, FR-16.8)', async () => {
  const o = await order('cash@x.co', 1, 'cash');
  assert.equal(o.status, 'awaiting_cash');
  await rejects(db.as(opsCurator, ({ q }) => q(`select decide_order($1, true)`, [o.order_id])), /order_not_pending/);
  await db.as(opsCurator, ({ q }) => q(`select mark_cash_paid($1)`, [o.order_id]));
  const t = await db.as(chairman, ({ one }) => one(`select account from transactions where order_id = $1`, [o.order_id]));
  assert.equal(t, undefined);
});

test('unpaid holds expire and release stock; sold out is refused', async () => {
  const before = await stock();
  const o = await order('late@x.co', 1);
  assert.equal(await stock(), before - 1);
  await db.q(`update orders set hold_expires_at = now() - interval '1 minute' where id = $1`, [o.order_id]);
  const n = await db.as('service', ({ one }) => one(`select expire_orders() as n`)).then((x) => x.n);
  assert.equal(n, 1);
  assert.equal(await stock(), before);
  await rejects(order('greedy@x.co', 3).then(() => order('greedy2@x.co', 3)), /sold_out/);
});

test('pickup scan: once only, never for unpaid orders (FR-16.9)', async () => {
  const o = await order('pick@x.co', 1, 'cash');
  const scan = (code) => db.as(lpAssoc, ({ one }) => one(`select pickup_order($1) as r`, [code])).then((x) => x.r);
  const paid = await db.as(opsCurator, ({ one }) => one(`select mark_cash_paid($1) as r`, [o.order_id])).then((x) => x.r);
  assert.equal((await scan(paid.pickup_code)).result, 'ok');
  assert.equal((await scan(paid.pickup_code)).result, 'already_delivered');
  assert.equal((await scan('nope')).result, 'not_found');
  await rejects(db.as(mediaExec, ({ q }) => q(`select pickup_order('x')`)), /not_allowed/);
});

test('refunds update signups without a bank entry; sales report by method (FR-16.10, FR-16.11)', async () => {
  await db.as(opsCurator, ({ q }) => q(`update packages set stock = stock + 10 where id = $1`, [pkg.id]));
  const o = await order('refund@x.co', 1, 'cash');
  await db.as(opsCurator, ({ q }) => q(`select mark_cash_paid($1)`, [o.order_id]));
  await rejects(db.as(pAssoc, ({ q }) => q(`select refund_order($1, 'Changed mind')`, [o.order_id])), /not_allowed/);
  await db.as(opsCurator, ({ q }) => q(`select refund_order($1, 'Damaged box')`, [o.order_id]));
  const t = await db.as(opsCurator, ({ q }) => q(`select kind, direction from transactions where order_id = $1 order by created_at`, [o.order_id]));
  assert.deepEqual(t, []);
  const refunded = await db.one('select status, transaction_id, refund_transaction_id from orders where id = $1', [o.order_id]);
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.transaction_id, null);
  assert.equal(refunded.refund_transaction_id, null);

  const sales = await db.as(opsCurator, ({ q }) => q(`select method, units from package_sales($1)`, [pkg.id]));
  assert.ok(sales.some((s) => s.method === 'cash'));
  await rejects(db.as(mediaExec, ({ q }) => q(`select * from package_sales()`)), /not_allowed/);
});

test('sign-up managers: Chairman, OD and Ops Curators, L&P and AE Executives', async () => {
  const aeExec = await db.member('executive', 'associates_experience');
  const odCurator = await db.member('curator', 'org_development');
  for (const who of [aeExec, odCurator, chairman]) {
    await db.as(who, ({ q }) => q(`insert into packages (name, kind, price_egp, stock) values ('Trip', 'trip', 0, 10)`));
  }
  await rejects(db.as(lpAssoc, ({ q }) => q(`insert into packages (name, price_egp, stock) values ('x', 0, 1)`)), /row-level security/);
});

test('member sign-up: required answers checked, free sign-ups confirmed, one per member', async () => {
  const qs = JSON.stringify([{ id: 'q1', label: 'Shirt size', kind: 'dropdown', required: true, options: ['S', 'M', 'L'] }]);
  const trip = await db.as(opsCurator, ({ one }) => one(
    `insert into packages (name, kind, price_egp, stock, is_active, questions) values ('Alex trip', 'trip', 0, 20, true, $1) returning id`, [qs]));
  await rejects(db.as(lpAssoc, ({ q }) => q(`select member_sign_up($1, '01012345678')`, [trip.id])), /answer_required/);
  const signUp = (who, size) => db.as(who, ({ one }) => one(
    `select member_sign_up($1, '01012345678', 1, 'cash', 'pickup', null, $2) as r`, [trip.id, JSON.stringify({ q1: size })])).then((x) => x.r);
  const r = await signUp(lpAssoc, 'M');
  assert.equal(r.status, 'approved');
  const mine = await db.as(lpAssoc, ({ one }) => one(`select answers, user_id from orders where id = $1`, [r.order_id]));
  assert.equal(mine.answers.q1, 'M');
  assert.equal(mine.user_id, lpAssoc);
  await rejects(signUp(lpAssoc, 'S'), /already_signed_up/);
  await rejects(db.as('anon', ({ q }) => q(`select member_sign_up($1, '0101')`, [trip.id])), /permission denied/);
  assert.equal((await db.as(mediaExec, ({ q }) => q(`select 1 from orders where id = $1`, [r.order_id]))).length, 0, 'others do not see it');
});

test('member sign-up for a paid package follows the payment steps', async () => {
  const r = await db.as(pAssoc, ({ one }) => one(`select member_sign_up($1, '01012345678', 1, 'cash') as r`, [pkg.id])).then((x) => x.r);
  assert.equal(r.status, 'awaiting_cash');
});

test('a member reopens only their own sign-up link', async () => {
  const mine = await db.as(pAssoc, ({ one }) => one(`select id from orders where user_id = $1 limit 1`, [pAssoc]));
  const token = await db.as(pAssoc, ({ one }) => one(`select member_order_link($1) as t`, [mine.id])).then((x) => x.t);
  const view = await db.as('anon', ({ one }) => one(`select get_order_by_token($1) as r`, [token])).then((x) => x.r);
  assert.equal(view.status, 'awaiting_cash');
  await rejects(db.as(lpAssoc, ({ q }) => q(`select member_order_link($1)`, [mine.id])), /not_found/);
});


test('pickup access requires leadership or an active member assignment', async () => {
  const unassigned = await db.member('associate', 'logistics_planning');
  const lpExec = await db.member('executive', 'logistics_planning');
  const aeExec = await db.member('executive', 'associates_experience');
  const otherCurator = await db.member('curator', 'marketing');
  const canScan = (who) => db.as(who, ({ one }) => one('select can_scan_pickups() as allowed')).then((r) => r.allowed);
  for (const who of [chairman, opsCurator, otherCurator, lpExec]) assert.equal(await canScan(who), true);
  for (const who of [unassigned, aeExec, mediaExec]) {
    assert.equal(await canScan(who), false);
    await rejects(db.as(who, ({ q }) => q("select pickup_order('unknown')")), /not_allowed/);
  }
  await rejects(db.as(aeExec, ({ q }) => q("insert into signup_pickup_scanners (package_id, user_id, expires_at) values ($2, $1, now() + interval '1 day')", [unassigned, pkg.id])), /row-level security/);
  await db.as(lpExec, ({ q }) => q("insert into signup_pickup_scanners (package_id, user_id, expires_at) values ($2, $1, now() + interval '1 day')", [unassigned, pkg.id]));
  assert.equal(await canScan(unassigned), true);
  await db.as(otherCurator, ({ q }) => q('delete from signup_pickup_scanners where user_id = $1', [unassigned]));
  assert.equal(await canScan(unassigned), false);
  await db.as(chairman, ({ q }) => q("insert into signup_pickup_scanners (package_id, user_id, expires_at) values ($2, $1, now() + interval '1 day')", [unassigned, pkg.id]));
  await db.q("update memberships set status = 'removed' where user_id = $1", [unassigned]);
  assert.equal(await canScan(unassigned), false);
});


test('scanner scope and expiry apply to pickup codes and typed order numbers', async () => {
  const member = await db.member('associate', 'media_design');
  const second = await db.as(opsCurator, ({ one }) => one("insert into packages (name, price_egp, stock, is_active) values ('Other signup', 10, 10, true) returning id"));
  await db.as(chairman, ({ q }) => q("insert into signup_pickup_scanners (package_id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [second.id, member]));
  const foreign = await db.as('service', ({ one }) => one("select place_order($1, 'Buyer', 'scoped@x.co', '01012345678', 1, 'cash') as r", [second.id])).then((r) => r.r);
  const paid = await db.as(opsCurator, ({ one }) => one('select mark_cash_paid($1) as r', [foreign.order_id])).then((r) => r.r);
  const main = await order('scope-main@x.co', 1, 'cash');
  const mainPaid = await db.as(opsCurator, ({ one }) => one('select mark_cash_paid($1) as r', [main.order_id])).then((r) => r.r);
  await rejects(db.as(member, ({ q }) => q('select pickup_order($1)', [mainPaid.pickup_code])), /not_allowed/);
  const scanned = await db.as(member, ({ one }) => one('select pickup_order($1) as r', [foreign.order_no])).then((r) => r.r);
  assert.equal(scanned.result, 'ok');
  assert.equal((await db.as(member, ({ one }) => one('select pickup_order($1) as r', [paid.pickup_code]))).r.result, 'already_delivered');
  await db.q("update signup_pickup_scanners set expires_at = now() - interval '1 minute' where user_id = $1", [member]);
  await rejects(db.as(member, ({ q }) => q('select pickup_order($1)', [paid.pickup_code])), /not_allowed/);
  await db.q("update signup_pickup_scanners set expires_at = now() + interval '1 day' where user_id = $1", [member]);
  await db.q("update packages set closes_at = now() - interval '1 minute' where id = $1", [second.id]);
  assert.equal((await db.as(member, ({ one }) => one('select can_scan_pickups() as ok'))).ok, false);
});
