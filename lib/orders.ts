import { dbGet, dbBatch } from './db';
import { txHash, roundCoin } from './coins';

// The single allowed state graph. Every status change in the whole app
// must go through transitionOrder() below — never write to orders.status
// directly anywhere else. Mirrors section 4.5 / 9 of the product spec.
const TRANSITIONS: Record<string, string[]> = {
  created: ['awaiting_payment', 'paid', 'on_hold_compliance', 'cancelled'],
  awaiting_payment: ['payment_detected', 'payment_review', 'paid', 'expired', 'cancelled', 'on_hold_compliance'],
  payment_detected: ['paid', 'on_hold_compliance'],
  // Non-USDT deposits: the user claims to have paid, but there is no
  // automated on-chain check for these networks yet, so the order parks
  // here until a human admin looks at the transfer themselves and either
  // confirms (-> paid) or rejects (-> cancelled) it from /admin/orders.
  // No AUTO_ADVANCE rule exists for this status on purpose — it never
  // times out or self-advances.
  payment_review: ['paid', 'cancelled', 'on_hold_compliance'],
  paid: ['processing', 'on_hold_compliance', 'refund_pending'],
  processing: ['completed', 'failed', 'on_hold_compliance'],
  on_hold_compliance: ['processing', 'refund_pending', 'cancelled'],
  refund_pending: ['refunded'],
  failed: ['processing', 'refund_pending'],
  completed: [],
  expired: [],
  cancelled: [],
  refunded: [],
};

export class InvalidTransitionError extends Error {}

function parseUtc(sqliteDatetime: string): number {
  // sqlite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" with no timezone
  // marker, which JS's Date parser treats as local time if not corrected.
  // It is always UTC, so normalize before parsing.
  return new Date(sqliteDatetime.replace(' ', 'T') + 'Z').getTime();
}

export async function transitionOrder(
  orderId: string,
  to: string,
  actor: 'user' | 'system' | 'admin',
  reason?: string
) {
  const order = await dbGet(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  if (!order) throw new Error('order not found');
  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(`Cannot go from ${order.status} to ${to}`);
  }
  await dbBatch([
    { sql: `UPDATE orders SET status = ? WHERE id = ?`, args: [to, orderId] },
    { sql: `INSERT INTO order_events (order_id, status, actor, reason) VALUES (?,?,?,?)`, args: [orderId, to, actor, reason || null] },
  ]);
  return { ...order, status: to };
}

export function canTransition(from: string, to: string) {
  return (TRANSITIONS[from] || []).includes(to);
}

// Marks the order completed and, for internal-balance destinations, credits
// the user's balance. Stands in for the real ExecutionProvider + custody
// payout described in the spec (sections 4.4 / 4.10) — no real transfer
// happens here.
async function finishOrder(orderId: string) {
  const o = await dbGet(`SELECT * FROM orders WHERE id=?`, [orderId]);
  if (!o || o.status !== 'processing') return;
  const outTx = txHash(orderId + 'out');
  await dbBatch([{ sql: `UPDATE orders SET tx_out = ? WHERE id = ?`, args: [outTx, orderId] }]);
  if (o.dest === 'internal') {
    const has = await dbGet(`SELECT 1 as x FROM balances WHERE user_id=? AND currency=?`, [o.user_id, o.to_currency]);
    const credit = roundCoin(o.amount_to);
    if (has) {
      await dbBatch([{ sql: `UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, args: [credit, o.user_id, o.to_currency] }]);
    } else {
      await dbBatch([{ sql: `INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, args: [o.user_id, o.to_currency, credit] }]);
    }
  }
  await transitionOrder(orderId, 'completed', 'system');
}

// How long an order sits in each state before auto-advancing, simulating
// network-confirmation latency. Replace with real webhook-driven transitions
// once an ExecutionProvider exists (spec section 4.4/4.10) — this is a
// placeholder so the prototype's order lifecycle is visible to a viewer
// without needing a live blockchain integration.
const AUTO_ADVANCE: Record<string, { next: string; afterMs: number; reason?: string }> = {
  payment_detected: { next: 'paid', afterMs: 2500, reason: 'Подтверждено сетью' },
  paid: { next: 'processing', afterMs: 1200 },
};

// Time-based progression, safe on serverless: rather than relying on a
// setTimeout surviving between requests (which Vercel does not guarantee),
// this checks elapsed time since the order's last event and advances it
// deterministically. Call this from any endpoint that reads or acts on an
// order; polling clients (1.5s interval) make the progression visible in
// near-real-time without any background process.
export async function advanceOrder(orderId: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const o = await dbGet(`SELECT * FROM orders WHERE id=?`, [orderId]);
    if (!o) return;

    if (o.status === 'awaiting_payment' && parseUtc(o.expires_at) < Date.now()) {
      await transitionOrder(orderId, 'expired', 'system', 'Оплата не поступила за 15 минут');
      continue;
    }

    if (o.status === 'processing') {
      const lastEvent = await dbGet(
        `SELECT created_at FROM order_events WHERE order_id=? ORDER BY created_at DESC, id DESC LIMIT 1`,
        [orderId]
      );
      const lastAt = lastEvent ? parseUtc(lastEvent.created_at) : 0;
      if (Date.now() - lastAt >= 2500) {
        await finishOrder(orderId);
        continue;
      }
      return;
    }

    const rule = AUTO_ADVANCE[o.status];
    if (!rule) return;
    const lastEvent = await dbGet(
      `SELECT created_at FROM order_events WHERE order_id=? ORDER BY created_at DESC, id DESC LIMIT 1`,
      [orderId]
    );
    const lastAt = lastEvent ? parseUtc(lastEvent.created_at) : 0;
    if (Date.now() - lastAt < rule.afterMs) return;
    await transitionOrder(orderId, rule.next, 'system', rule.reason);
  }
}
