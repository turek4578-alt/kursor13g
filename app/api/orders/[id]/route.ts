import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbAll, dbGet } from '@/lib/db';
import { transitionOrder, advanceOrder, InvalidTransitionError } from '@/lib/orders';
import { notifyAdminTelegram } from '@/lib/telegram';

async function loadOrder(id: string, userId: string) {
  const o = await dbGet(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!o) return null;
  const events = await dbAll(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC`, [id]);
  return { ...o, events };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { id } = await params;

  const owned = await dbGet(`SELECT id FROM orders WHERE id=? AND user_id=?`, [id, u.id]);
  if (!owned) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  await advanceOrder(id);

  const order = await loadOrder(id, u.id);
  if (!order) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  return NextResponse.json({ order });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { id } = await params;
  const { action } = await req.json();
  const o = await dbGet(`SELECT * FROM orders WHERE id=? AND user_id=?`, [id, u.id]);
  if (!o) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  try {
    if (action === 'cancel') {
      await transitionOrder(id, 'cancelled', 'user');
    } else if (action === 'i_paid') {
      // User confirms they sent the deposit directly to the address shown
      // on this screen. There is no automated on-chain check wired into
      // this endpoint for ANY coin — including USDT: the only real
      // blockchain check in the app lives in /api/wallets/check-deposit,
      // scoped to topping up wallet balance, not paying for an exchange
      // order directly. So every self-attested "I paid" here, regardless
      // of currency, parks the order for a human admin to verify the
      // transfer themselves and confirm/reject from /admin/orders. The
      // only way to skip this is to already hold verified balance (topped
      // up via Кошельки, either via the real check or an admin-confirmed
      // deposit request) — orders paid from existing balance settle
      // instantly via payFromBalance in /api/orders, with no re-check,
      // since that balance was already verified once.
      if (o.status !== 'awaiting_payment') throw new InvalidTransitionError('not awaiting payment');
      await transitionOrder(id, 'payment_review', 'user', 'Пользователь заявил об оплате — требуется проверка администратором');
      await notifyAdminTelegram(
        `🔄 <b>Заявка на обмен ждёт проверки оплаты</b>\n${u.email}\nЗаявка ${o.public_id}: ${o.amount_from} ${o.from_currency} → ${o.to_currency}\nТребуется ручная проверка в /admin/orders.`
      ).catch(() => {});
    }
  } catch (e) {
    if (e instanceof InvalidTransitionError) {
      return NextResponse.json({ error: 'Недопустимое действие для текущего статуса' }, { status: 409 });
    }
    throw e;
  }

  await advanceOrder(id);
  const order = await loadOrder(id, u.id);
  return NextResponse.json({ order });
}
