import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const rows = await dbAll(
    `SELECT w.*, u.email as user_email, u.name as user_name
     FROM withdrawals w JOIN users u ON u.id = w.user_id
     ORDER BY w.created_at DESC`
  );
  return NextResponse.json({ withdrawals: rows });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { id, action, note } = await req.json();
  const w = await dbGet(`SELECT * FROM withdrawals WHERE id=?`, [id]);
  if (!w) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  if (w.status !== 'pending') return NextResponse.json({ error: 'Заявка уже обработана' }, { status: 400 });

  if (action === 'complete') {
    await dbRun(`UPDATE withdrawals SET status='completed', admin_note=?, resolved_at=datetime('now') WHERE id=?`, [note || null, id]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'withdrawal_completed',
      'withdrawal ' + id,
      `${w.amount} ${w.coin} → ${w.address}`,
    ]);
  } else if (action === 'reject') {
    if (!note) return NextResponse.json({ error: 'Укажите причину отказа' }, { status: 400 });
    // refund the reserved balance back to the user
    const bal = await dbGet(`SELECT 1 as x FROM balances WHERE user_id=? AND currency=?`, [w.user_id, w.coin]);
    if (bal) await dbRun(`UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, [w.amount, w.user_id, w.coin]);
    else await dbRun(`INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, [w.user_id, w.coin, w.amount]);
    await dbRun(`UPDATE withdrawals SET status='rejected', admin_note=?, resolved_at=datetime('now') WHERE id=?`, [note, id]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'withdrawal_rejected',
      'withdrawal ' + id,
      `${w.amount} ${w.coin} возвращено на баланс: ${note}`,
    ]);
  } else {
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
