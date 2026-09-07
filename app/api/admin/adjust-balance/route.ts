import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbGet, dbRun } from '@/lib/db';
import { COINS } from '@/lib/coins';
import { parseAmount } from '@/lib/parseAmount';

// Manual balance adjustment — for crediting a real deposit that arrived on
// a coin/network without an automated checker (see CHECKABLE_COINS), after
// the admin has independently confirmed it (e.g. by looking at a block
// explorer for that address). Every use is logged with the reason, and the
// amount can be negative to correct a mistake.
export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { userId, coin, amount, reason } = await req.json();
  if (!userId || !coin || !COINS[coin]) return NextResponse.json({ error: 'Не хватает параметров' }, { status: 400 });
  const amt = parseAmount(amount);
  if (!amt || amt === 0) return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
  if (!reason || !reason.trim()) return NextResponse.json({ error: 'Укажите причину корректировки' }, { status: 400 });

  const user = await dbGet(`SELECT email FROM users WHERE id=?`, [userId]);
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

  const bal = await dbGet(`SELECT amount FROM balances WHERE user_id=? AND currency=?`, [userId, coin]);
  const current = bal?.amount || 0;
  if (current + amt < 0) return NextResponse.json({ error: 'Баланс не может стать отрицательным' }, { status: 400 });

  if (bal) await dbRun(`UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, [amt, userId, coin]);
  else await dbRun(`INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, [userId, coin, amt]);

  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    staff.email,
    'balance_adjust',
    'user ' + user.email,
    `${amt > 0 ? '+' : ''}${amt} ${coin}: ${reason.trim()}`,
  ]);

  return NextResponse.json({ ok: true });
}
