import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbGet, dbRun } from '@/lib/db';
import { COINS } from '@/lib/coins';
import { isValidAddressForNetwork } from '@/lib/addressValidation';

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { userId, coin, address } = await req.json();
  if (!userId || !coin || !COINS[coin]) return NextResponse.json({ error: 'Не хватает параметров' }, { status: 400 });

  const user = await dbGet(`SELECT id, email FROM users WHERE id=?`, [userId]);
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

  if (!address || !address.trim()) {
    // empty address = remove override, fall back to the display-only address
    await dbRun(`DELETE FROM wallet_overrides WHERE user_id=? AND coin=?`, [userId, coin]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'wallet_override_removed',
      'user ' + user.email,
      coin,
    ]);
    return NextResponse.json({ ok: true, address: null });
  }

  const clean = address.trim();
  const network = COINS[coin].net;

  // Reject anything that isn't a real-shaped address for the coin's network.
  // A placeholder like "111...1" would otherwise sit in the database looking
  // legitimate — for USDT specifically it would also quietly break the
  // check-deposit flow later.
  if (!isValidAddressForNetwork(network, clean)) {
    return NextResponse.json(
      { error: `Это не похоже на настоящий адрес в сети ${network}. Проверьте формат.` },
      { status: 400 }
    );
  }

  await dbRun(
    `INSERT INTO wallet_overrides (user_id, coin, address, set_by) VALUES (?,?,?,?)
     ON CONFLICT(user_id, coin) DO UPDATE SET address=excluded.address, set_by=excluded.set_by, created_at=datetime('now')`,
    [userId, coin, clean, staff.email]
  );
  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    staff.email,
    'wallet_override_set',
    'user ' + user.email,
    `${coin} → ${clean}`,
  ]);
  return NextResponse.json({ ok: true, address: clean });
}
