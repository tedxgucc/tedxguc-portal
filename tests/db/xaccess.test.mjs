// X Access (FR-18): who manages, cards, verify, PIN redemptions, banner clicks.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createDb, rejects } from './harness.mjs';

let db, chairman, opsCurator, pExec, pAssoc, mediaExec, member, partner;

before(async () => {
  db = await createDb();
  chairman = await db.member('chairman');
  opsCurator = await db.member('curator', 'operations');
  pExec = await db.member('executive', 'partnerships');
  pAssoc = await db.member('associate', 'partnerships');
  mediaExec = await db.member('executive', 'media_design');
  member = await db.member('associate', 'media_design');
  partner = await db.as(pExec, ({ one }) => one(
    `insert into xaccess_partners (name, perk, in_banner, banner_offer, promo_code) values ('Brewhouse', '15% off drinks', true, '15% OFF', 'TEDX15') returning id`));
});

test('Partnerships executives, the Ops Curator and the Chairman manage partners; others cannot', async () => {
  await db.as(opsCurator, ({ q }) => q(`insert into xaccess_partners (name, perk) values ('Printly', 'Free delivery')`));
  await rejects(db.as(pAssoc, ({ q }) => q(`insert into xaccess_partners (name, perk) values ('x', 'y')`)), /row-level security/);
  await rejects(db.as(mediaExec, ({ q }) => q(`insert into xaccess_partners (name, perk) values ('x', 'y')`)), /row-level security/);
});

test('all 50 supplied sponsors are public with matched logos and exact offers', async () => {
  const source = JSON.parse(readFileSync(new URL('../../web/src/lib/data/xaccess-sponsors.json', import.meta.url), 'utf8'));
  const corrections = JSON.parse(readFileSync(new URL('../../web/src/lib/data/xaccess-name-corrections.json', import.meta.url), 'utf8'));
  const rows = await db.as('anon', ({ q }) => q(`select name, logo_url, perk, terms, promo_code from xaccess_partners where id::text like '58414343-4553-4000-8000-%' order by sort_order`));
  assert.equal(rows.length, 50);
  for (let i = 0; i < source.length; i++) {
    const s = source[i], p = rows[i];
    assert.equal(p.name, corrections.find((c) => c.number === s.number)?.name ?? s.name);
    assert.equal(p.perk, s.discount ? `${s.discount} off` : s.details);
    assert.equal(p.promo_code, s.details.startsWith('Code:') ? s.details.slice(5).trim() : null);
    assert.equal(p.terms, s.discount && s.details && !s.details.startsWith('Code:') ? s.details : null);
    assert.equal(p.logo_url, `/brand/xaccess/${String(s.number).padStart(2, '0')}.png`);
    assert.ok(existsSync(new URL(`../../web/public${p.logo_url}`, import.meta.url)));
  }
});

test('each manager can edit imported names and logos; associates cannot', async () => {
  const id = '58414343-4553-4000-8000-000000000001';
  for (const manager of [chairman, opsCurator, pExec]) {
    const row = await db.as(manager, ({ one }) => one(`update xaccess_partners set name = 'Mulliri', logo_url = '/brand/xaccess/01.png' where id = $1 returning id`, [id]));
    assert.equal(row.id, id);
  }
  const rows = await db.as(pAssoc, ({ q }) => q(`update xaccess_partners set name = 'Changed' where id = $1 returning id`, [id]));
  assert.equal(rows.length, 0);
});

test('guests see current perks but never the PIN', async () => {
  await db.as(pExec, ({ q }) => q(`select set_xaccess_pin($1, '4321')`, [partner.id]));
  await db.as(pExec, ({ q }) => q(`insert into xaccess_partners (name, perk, expires_on) values ('Old', 'gone', current_date - 1)`));
  const rows = await db.as('anon', ({ q }) => q(`select name from xaccess_partners order by name`));
  assert.ok(rows.some((r) => r.name === 'Brewhouse'));
  assert.ok(!rows.some((r) => r.name === 'Old'), 'expired perks are hidden');
  await rejects(db.as('anon', ({ q }) => q(`select pin_hash from xaccess_partners`)), /permission denied/);
});

test('issuing: numbered cards, one active card per member, bulk for members', async () => {
  await rejects(db.as(mediaExec, ({ q }) => q(`select issue_xaccess_card('Guest')`)), /not_allowed/);
  const a = await db.as(pExec, ({ one }) => one(`select issue_xaccess_card('Salma Tarek', 'salma@example.com') as r`)).then((x) => x.r);
  assert.match(a.number, /^XA-\d{2}-0001$/);
  const b = await db.as(pExec, ({ one }) => one(`select issue_xaccess_card('Member One', null, $1) as r`, [member])).then((x) => x.r);
  assert.match(b.number, /-0002$/);
  await rejects(db.as(pExec, ({ q }) => q(`select issue_xaccess_card('Again', null, $1)`, [member])), /already_has_card/);
  const n = await db.as(opsCurator, ({ one }) => one(`select issue_xaccess_for_members() as n`)).then((x) => x.n);
  assert.ok(n >= 5, 'every other active member got one');
  // A member sees only their own card.
  const mine = await db.as(member, ({ q }) => q(`select number from xaccess_cards`));
  assert.deepEqual(mine.map((r) => r.number), [b.number]);
  assert.equal((await db.as(pAssoc, ({ q }) => q(`select 1 from xaccess_cards`))).length > 2, true, 'Partnerships can view all');
  await rejects(db.as(pAssoc, ({ q }) => q(`update xaccess_cards set status = 'cancelled' where id = $1`, [a.id]).then((r) => {
    if (!r.length) throw new Error('row-level security: no rows');
  })), /row-level security|no rows/);
});

test('verify shows valid / expired and the first name only; cancelled cards fail', async () => {
  const c = await db.as(pExec, ({ one }) => one(`select issue_xaccess_card('Omar Fathy Ali') as r`)).then((x) => x.r);
  const v = await db.as('anon', ({ one }) => one(`select verify_xaccess($1) as r`, [c.code])).then((x) => x.r);
  assert.equal(v.status, 'valid');
  assert.equal(v.first_name, 'Omar');
  assert.ok(!JSON.stringify(v).includes('Fathy'));
  assert.equal((await db.as('anon', ({ one }) => one(`select verify_xaccess('nope') as r`)).then((x) => x.r)).status, 'not_found');
  await db.as(pExec, ({ q }) => q(`update xaccess_cards set status = 'cancelled' where id = $1`, [c.id]));
  assert.equal((await db.as('anon', ({ one }) => one(`select verify_xaccess($1) as r`, [c.code])).then((x) => x.r)).status, 'cancelled');
  await db.as(pExec, ({ q }) => q(`update xaccess_cards set status = 'active', expires_on = current_date - 1 where id = $1`, [c.id]));
  assert.equal((await db.as('anon', ({ one }) => one(`select verify_xaccess($1) as r`, [c.code])).then((x) => x.r)).status, 'expired');
});

test('partners log a use with their PIN; wrong PINs are counted and limited', async () => {
  const c = await db.as(pExec, ({ one }) => one(`select issue_xaccess_card('Hana Mostafa') as r`)).then((x) => x.r);
  const redeem = (pin) => db.as('anon', ({ one }) => one(`select redeem_xaccess($1, $2, $3) as r`, [c.code, partner.id, pin])).then((x) => x.r);
  assert.equal((await redeem('0000')).error, 'wrong_pin');
  const ok = await redeem('4321');
  assert.equal(ok.ok, true);
  assert.equal(ok.first_name, 'Hana');
  const log = await db.as(pAssoc, ({ q }) => q(`select 1 from xaccess_redemptions where partner_id = $1`, [partner.id]));
  assert.equal(log.length, 1);
  for (let i = 0; i < 20; i++) await redeem('1111');
  assert.equal((await redeem('4321')).error, 'too_many_tries');
});

test('banner clicks are counted per sponsor per day', async () => {
  await db.as('anon', ({ q }) => q(`select xaccess_banner_click($1)`, [partner.id]));
  await db.as('anon', ({ q }) => q(`select xaccess_banner_click($1)`, [partner.id]));
  const r = await db.as(pExec, ({ one }) => one(`select clicks from xaccess_banner_clicks where partner_id = $1`, [partner.id]));
  assert.equal(r.clicks, 2);
});
