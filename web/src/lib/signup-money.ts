import type { Order } from './types';
export function signupMoney(orders: Order[], now = Date.now()) {
  let collected = 0, refunded = 0, outstanding = 0;
  for (const o of orders) {
    if (o.status === 'approved' || o.status === 'delivered') collected += Number(o.total_egp);
    else if (o.status === 'refunded') refunded += Number(o.total_egp);
    else if (['pending_proof', 'pending_approval', 'awaiting_cash'].includes(o.status) && (!o.hold_expires_at || Date.parse(o.hold_expires_at) > now)) outstanding += Number(o.total_egp);
  }
  return { expected: collected + outstanding, collected, refunded, outstanding };
}
