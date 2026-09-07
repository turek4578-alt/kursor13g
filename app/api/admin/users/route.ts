import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { COINS } from '@/lib/coins';

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const userId = req.nextUrl.searchParams.get('id');

  if (userId) {
    const u = await dbGet(`SELECT * FROM users WHERE id=?`, [userId]);
    if (!u) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const balRows = await dbAll(`SELECT currency, amount FROM balances WHERE user_id=?`, [userId]);
    const balances: Record<string, number> = {};
    for (const c of Object.keys(COINS)) balances[c] = 0;
    for (const r of balRows) balances[r.currency] = r.amount;
    const orders = await dbAll(`SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC`, [userId]);
    const overrides = await dbAll(`SELECT coin, address FROM wallet_overrides WHERE user_id=?`, [userId]);
    return NextResponse.json({ user: { ...u, balances }, orders, overrides });
  }

  const users = await dbAll(`SELECT * FROM users ORDER BY created_at DESC`);
  const orderCounts = await dbAll(
    `SELECT user_id, COUNT(*) as n FROM orders GROUP BY user_id`
  );
  const map: Record<string, number> = {};
  for (const r of orderCounts) map[r.user_id] = r.n;
  const out = users.map((u) => ({ ...u, orderCount: map[u.id] || 0 }));
  return NextResponse.json({ users: out });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { userId, action, reason, level } = await req.json();
  const u = await dbGet(`SELECT * FROM users WHERE id=?`, [userId]);
  if (!u) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  if (action === 'block' || action === 'unblock') {
    if (!reason) return NextResponse.json({ error: 'Причина обязательна' }, { status: 400 });
    await dbRun(`UPDATE users SET status=? WHERE id=?`, [action === 'block' ? 'blocked' : 'active', userId]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'user_' + action,
      'user ' + u.email,
      reason,
    ]);
  } else if (action === 'kyc_approve') {
    const newLevel = level ?? Math.min(1, u.kyc_level + 1);
    await dbRun(
      `UPDATE users SET kyc_status='approved', kyc_level=?, kyc_photo_document=NULL, kyc_photo_selfie=NULL WHERE id=?`,
      [newLevel, userId]
    );
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'kyc_approved',
      'user ' + u.email,
      'L' + newLevel,
    ]);
  } else if (action === 'kyc_reject') {
    if (!reason) return NextResponse.json({ error: 'Причина обязательна' }, { status: 400 });
    await dbRun(`UPDATE users SET kyc_status='rejected', kyc_photo_document=NULL, kyc_photo_selfie=NULL WHERE id=?`, [userId]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'kyc_rejected',
      'user ' + u.email,
      reason,
    ]);
  } else {
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
