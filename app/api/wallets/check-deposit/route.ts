import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbGet, dbRun } from '@/lib/db';
import { getTrc20Transfers, fromTrc20Units, isValidTronAddress } from '@/lib/tron';

// Real blockchain check — no simulated/random amounts. Only works for a
// coin+user that has an admin-assigned address in wallet_overrides (see
// /api/admin/wallet-override) and currently only implemented for USDT on
// Tron (TRC20). Each on-chain transaction is credited at most once, enforced
// by crypto_deposits.tx_id being a primary key.
export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { coin } = await req.json();
  if (coin !== 'USDT') {
    return NextResponse.json({ error: 'Проверка блокчейна пока реализована только для USDT (TRC20)' }, { status: 400 });
  }

  const override = await dbGet(`SELECT address FROM wallet_overrides WHERE user_id=? AND coin=?`, [u.id, coin]);
  if (!override) {
    return NextResponse.json({ error: 'Для этого аккаунта не назначен реальный адрес приёма' }, { status: 400 });
  }
  if (!isValidTronAddress(override.address)) {
    return NextResponse.json(
      { error: 'Назначенный адрес не похож на настоящий Tron-адрес — обратитесь к администратору, чтобы его исправить' },
      { status: 400 }
    );
  }

  let transfers;
  try {
    transfers = await getTrc20Transfers(override.address);
  } catch (e: any) {
    return NextResponse.json({ error: 'Не удалось обратиться к блокчейну: ' + e.message }, { status: 502 });
  }

  let creditedTotal = 0;
  let creditedCount = 0;
  for (const t of transfers) {
    const already = await dbGet(`SELECT tx_id FROM crypto_deposits WHERE tx_id=?`, [t.transactionId]);
    if (already) continue;
    const amount = fromTrc20Units(t.value);
    if (amount <= 0) continue;

    // record first (idempotency key), then credit — if the credit step
    // fails we'd rather investigate a missed credit than risk a double one
    try {
      await dbRun(`INSERT INTO crypto_deposits (tx_id, user_id, coin, amount, address) VALUES (?,?,?,?,?)`, [
        t.transactionId,
        u.id,
        coin,
        amount,
        override.address,
      ]);
    } catch {
      // unique constraint hit — another concurrent check already claimed this tx
      continue;
    }

    const bal = await dbGet(`SELECT amount FROM balances WHERE user_id=? AND currency=?`, [u.id, coin]);
    if (bal) await dbRun(`UPDATE balances SET amount = amount + ? WHERE user_id=? AND currency=?`, [amount, u.id, coin]);
    else await dbRun(`INSERT INTO balances (user_id, currency, amount) VALUES (?,?,?)`, [u.id, coin, amount]);

    creditedTotal += amount;
    creditedCount += 1;
  }

  return NextResponse.json({ ok: true, creditedTotal, creditedCount, checked: transfers.length });
}
