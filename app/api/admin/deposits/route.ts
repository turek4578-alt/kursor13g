import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const requests = await dbAll(
    `SELECT d.*, u.email AS user_email FROM deposit_requests d JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 200`
  );
  return NextResponse.json({ requests });
}

// Confirm actually credits the claimed amount to the user's balance —
// only do this after checking the address on a block explorer yourself.
// Reject just closes the claim with no balance change.
export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { id, action, note } = await req.json();
  const r = await dbGet(`SELECT * FROM deposit_requests WHERE id = ?`, [id]);
  if (!r) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  if (r.status !== 'pending') return NextResponse.json({ error: 'Заявка уже обработана' }, { status: 409 });

  if (action === 'confirm') {
    const bal = await dbGet(`SELECT amount FROM balances WHERE user_id=? AND currency=?`, [r.user_id, r.coin]);
    if (bal) await dbRun(`UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, [r.amount, r.user_id, r.coin]);
    else await dbRun(`INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, [r.user_id, r.coin, r.amount]);
    await dbRun(
      `UPDATE deposit_requests SET status='confirmed', admin_note=?, resolved_at=datetime('now') WHERE id=?`,
      [note || null, id]
    );
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'deposit_confirmed',
      'user ' + r.user_id,
      `+${r.amount} ${r.coin}`,
    ]);
  } else if (action === 'reject') {
    await dbRun(
      `UPDATE deposit_requests SET status='rejected', admin_note=?, resolved_at=datetime('now') WHERE id=?`,
      [note || null, id]
    );
  } else {
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
