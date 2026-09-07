import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { transitionOrder, advanceOrder, InvalidTransitionError } from '@/lib/orders';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const orders = await dbAll(
    `SELECT o.*, u.name as user_name, u.email as user_email, u.kyc_level as user_level
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`
  );
  await Promise.all(
    orders.filter((o) => !['completed', 'expired', 'cancelled', 'refunded', 'failed'].includes(o.status)).map((o) => advanceOrder(o.id))
  );
  const fresh = await dbAll(
    `SELECT o.*, u.name as user_name, u.email as user_email, u.kyc_level as user_level
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`
  );
  const full = await Promise.all(
    fresh.map(async (o) => ({ ...o, events: await dbAll(`SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC, id ASC`, [o.id]) }))
  );
  return NextResponse.json({ orders: full });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { orderId, to, reason } = await req.json();
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'Комментарий обязателен' }, { status: 400 });
  }
  const o = await dbGet(`SELECT * FROM orders WHERE id=?`, [orderId]);
  if (!o) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  try {
    await transitionOrder(orderId, to, 'admin', reason);
  } catch (e) {
    if (e instanceof InvalidTransitionError) {
      return NextResponse.json({ error: 'Недопустимый переход статуса' }, { status: 409 });
    }
    throw e;
  }

  if (to === 'refunded' && o.tx_in === null) {
    // refund what was paid from balance
    const has = await dbGet(`SELECT 1 as x FROM balances WHERE user_id=? AND currency=?`, [o.user_id, o.from_currency]);
    if (has) await dbRun(`UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, [o.amount_from, o.user_id, o.from_currency]);
    else await dbRun(`INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, [o.user_id, o.from_currency, o.amount_from]);
  }

  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    staff.email,
    'order_' + to,
    'order ' + o.public_id,
    `${o.status} → ${to}: ${reason}`,
  ]);

  if (to === 'processing') await advanceOrder(orderId);

  return NextResponse.json({ ok: true });
}
