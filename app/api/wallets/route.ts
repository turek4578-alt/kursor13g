import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { COINS, addressFor, roundCoin } from '@/lib/coins';
import { parseAmount } from '@/lib/parseAmount';
import { notifyAdminTelegram } from '@/lib/telegram';
import { randomUUID } from 'crypto';
import { authenticator } from 'otplib';

export async function GET() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const rows = await dbAll(`SELECT currency, amount FROM balances WHERE user_id=?`, [u.id]);
  const balances: Record<string, number> = {};
  for (const c of Object.keys(COINS)) balances[c] = 0;
  for (const r of rows) balances[r.currency] = r.amount;
  const overrides = await dbAll(`SELECT coin, address FROM wallet_overrides WHERE user_id=?`, [u.id]);
  const overrideMap: Record<string, string> = {};
  for (const o of overrides) overrideMap[o.coin] = o.address;
  const wallets = Object.keys(COINS).map((c) => ({
    coin: c,
    network: COINS[c].net,
    address: overrideMap[c] || addressFor(u.email, c),
    // "real" means: this address is on-chain-checkable and was assigned by
    // an admin (or the user), not a display-only generated string. Only
    // USDT/TRC20 currently has a working blockchain check (lib/tron.ts).
    real: c === 'USDT' && !!overrideMap[c],
    balance: balances[c],
  }));
  return NextResponse.json({ wallets });
}

// NOTE: this endpoint credits/debits balances directly with no underlying
// blockchain transfer. It exists so the prototype's wallet screen has
// something to click. Real deposit crediting must come from a blockchain
// monitoring webhook (section 4.10); real withdrawal must go through the
// ExecutionProvider / custody payout flow (section 4.4) — never a direct
// balance mutation from a client request, as this route does.
// NOTE ON action==='withdraw': this reserves (debits) balance immediately
// but the real send is still done by a human admin — see below.
export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { action, coin, amount, address, code } = await req.json();
  if (!COINS[coin]) return NextResponse.json({ error: 'Неизвестная монета' }, { status: 400 });

  if (action === 'deposit') {
    // No automated on-chain check exists for this coin (that's the 'real'
    // flag from GET above — only USDT/TRC20 with an admin-assigned address
    // has one). Rather than trusting the click and crediting a made-up
    // amount, this records what the user says they sent and parks it for
    // a human admin to verify against the actual blockchain and confirm or
    // reject from /admin/deposits. No balance is touched here.
    const amt = parseAmount(amount);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Укажите сумму перевода' }, { status: 400 });
    const override = await dbGet(`SELECT address FROM wallet_overrides WHERE user_id=? AND coin=?`, [u.id, coin]);
    const addr = override?.address || addressFor(u.email, coin);
    const id = randomUUID();
    await dbRun(
      `INSERT INTO deposit_requests (id, user_id, coin, amount, address) VALUES (?,?,?,?,?)`,
      [id, u.id, coin, amt, addr]
    );
    await notifyAdminTelegram(
      `💰 <b>Заявка на пополнение</b>\n${u.email}\n${amt} ${coin} → <code>${addr}</code>\nТребуется ручная проверка в /admin/deposits.`
    ).catch(() => {});
    return NextResponse.json({ ok: true, requestId: id });
  }

  if (action === 'withdraw') {
    const amt = parseAmount(amount);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    if (!address || address.trim().length < 12) return NextResponse.json({ error: 'Введите адрес' }, { status: 400 });
    if (!u.twofa_enabled || !u.twofa_secret) return NextResponse.json({ error: 'Для вывода включите 2FA' }, { status: 400 });
    if (!code || !authenticator.verify({ token: String(code).trim(), secret: u.twofa_secret })) {
      return NextResponse.json({ error: 'Неверный код 2FA' }, { status: 400 });
    }
    const balRow = await dbGet(`SELECT amount FROM balances WHERE user_id=? AND currency=?`, [u.id, coin]);
    const bal = balRow?.amount || 0;
    // Same float-noise tolerance as the exchange balance check — withdrawing
    // exactly "the max" button amount must not get rejected because the
    // stored balance is a hair below the parsed amount due to float drift.
    if (roundCoin(amt) > roundCoin(bal)) return NextResponse.json({ error: 'Недостаточно средств' }, { status: 400 });

    // Balance is reserved (debited) immediately so it can't be spent twice,
    // but this is NOT a completed transfer — it's a request. A human admin
    // sends the real crypto and marks it done via /api/admin/withdrawals.
    const id = randomUUID();
    const debit = Math.min(amt, bal);
    await dbRun(`UPDATE balances SET amount = amount - ? WHERE user_id=? AND currency=?`, [debit, u.id, coin]);
    await dbRun(`INSERT INTO withdrawals (id, user_id, coin, amount, address, status) VALUES (?,?,?,?,?,'pending')`, [
      id,
      u.id,
      coin,
      amt,
      address.trim(),
    ]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      'system',
      'withdrawal_requested',
      'user ' + u.email,
      `${amt} ${coin} → ${address.trim().slice(0, 10)}…`,
    ]);

    await notifyAdminTelegram(
      `💸 <b>Запрос на вывод</b>\n${u.email}\n${amt} ${coin} → <code>${address.trim()}</code>\nОбработать вручную в админке.`
    );

    return NextResponse.json({ ok: true, withdrawalId: id });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
