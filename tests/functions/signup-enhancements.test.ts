import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signupMoney } from '../../web/src/lib/signup-money.ts';
import { announcementLive } from '../../web/src/lib/announcements.ts';
import type { Order, Announcement } from '../../web/src/lib/types.ts';

test('payment summary counts live commitments and excludes refunds and closed reservations', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const order = (status: Order['status'], total: number, expires: string | null = null) => ({ status, total_egp: total, hold_expires_at: expires } as Order);
  const summary = signupMoney([
    order('approved', 100), order('delivered', 50), order('refunded', 30),
    order('pending_approval', 40), order('awaiting_cash', 20), order('pending_proof', 10, '2026-10-30T12:00:00Z'),
    order('pending_proof', 500, '2026-10-28T12:00:00Z'),
    order('cancelled', 900), order('rejected', 900), order('expired', 900), order('approved', 0),
  ], now);
  assert.deepEqual(summary, { expected: 220, collected: 150, refunded: 30, outstanding: 70 });
  assert.deepEqual(signupMoney([], now), { expected: 0, collected: 0, refunded: 0, outstanding: 0 });
});

test('billboard visibility respects publication and expiry boundaries', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(announcementLive({} as Announcement, now), true);
  assert.equal(announcementLive({ publish_at: '2026-10-29T12:00:00Z' } as Announcement, now), true);
  assert.equal(announcementLive({ publish_at: '2026-10-29T12:01:00Z' } as Announcement, now), false);
  assert.equal(announcementLive({ expires_at: '2026-10-29T12:00:00Z' } as Announcement, now), false);
  assert.equal(announcementLive({ expires_at: '2026-10-29T12:01:00Z' } as Announcement, now), true);
});
