import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbAll, dbGet, dbRun, dbBatch } from '@/lib/db';
import { addressFor, shortOrderId, COINS, priceOrFallback, roundCoin } from '@/lib/coins';
import { getRealPrices } from '@/lib/priceFeed';
import { transitionOrder, advanceOrder } from '@/lib/orders';
import { randomUUID } from 'crypto';
import { parseAmount } from '@/lib/parseAmount';
import { notifyAdminTelegram } from '@/lib/telegram';

const LIMITS: Record<number, number> = { 0: 1000, 1: 50000 };

export async function GET() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const orders = await dbAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [u.id]);
  // let time-based progress apply before returning (non-final orders only)
  await Promise.all(
    orders.filter((o) => !['completed', 'expired', 'cancelled', 'refunded', 'failed'].includes(o.status)).map((o) => advanceOrder(o.id))
  );
  const fresh = await dbAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [u.id]);
  const full = await Promise.all(
    fresh.map(async (o) => ({ ...o, events: await dbAll(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC`, [o.id]) }))
  );
  return NextResponse.json({ orders: full });
}

export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const killRow = await dbGet(`SELECT value FROM settings WHERE key='kill_switch'`);
  if (killRow?.value === '1') return NextResponse.json({ error: 'Обмен временно приостановлен' }, { status: 423 });

  const { from, to, amount, dest, address } = await req.json();
  if (!COINS[from] || !COINS[to] || from === to) {
    return NextResponse.json({ error: 'Некорректная пара' }, { status: 400 });
  }
  const amt = parseAmount(amount);
  if (!amt || amt <= 0) return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });

  const pair = await dbGet(`SELECT * FROM pairs WHERE from_currency=? AND to_currency=?`, [from, to]);
  if (!pair || !pair.enabled) return NextResponse.json({ error: 'Пара недоступна' }, { status: 400 });

  const prices = await getRealPrices();
  const priceOf = (c: string) => priceOrFallback(prices, c);

  const usdAmt = amt * priceOf(from);
  if (usdAmt < pair.min_usd) return NextResponse.json({ error: `Минимум $${pair.min_usd}` }, { status: 400 });
  const limit = LIMITS[u.kyc_level] ?? 1000;
  if (usdAmt > limit) return NextResponse.json({ error: `Превышен лимит уровня верификации ($${limit})` }, { status: 400 });
  if (dest === 'address' && (!address || address.trim().length < 12)) {
    return NextResponse.json({ error: 'Введите адрес получателя' }, { status: 400 });
  }

  const raw = priceOf(from) / priceOf(to);
  const our = raw * (1 - pair.spread_bps / 10000);
  const amountTo = roundCoin(amt * our);
  const spreadUsd = amt * (raw - our) * priceOf(to);
  const id = randomUUID();
  const publicId = shortOrderId();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // crude address-based risk screen — a stand-in for a real AML/address
  // screening provider (section 4.2). Flags obviously-marked test strings.
  const risk = dest === 'address' && /dead|bad|1111|scam/i.test(address || '') ? 82 : Math.floor(Math.random() * 25);

  const balRow = await dbGet(`SELECT amount FROM balances WHERE user_id=? AND currency=?`, [u.id, from]);
  const balance = balRow?.amount || 0;
  // roundCoin both sides before comparing — a balance that's short of the
  // requested amount only by float noise (e.g. paying back exactly what an
  // earlier trade credited) must still count as "enough", or the user gets
  // sent to an external deposit screen for an amount they already have.
  const payFromBalance = roundCoin(balance) >= roundCoin(amt);

  await dbRun(
    `INSERT INTO orders (id, public_id, user_id, from_currency, to_currency, amount_from, amount_to, rate, partner_rate, spread_usd, status, dest, payout_address, deposit_address, risk_score, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      publicId,
      u.id,
      from,
      to,
      amt,
      amountTo,
      our,
      raw,
      spreadUsd,
      'created',
      dest,
      dest === 'address' ? address.trim() : null,
      payFromBalance ? null : addressFor(u.email + '#' + id, from),
      risk,
      expiresAt,
    ]
  );
  await dbRun(`INSERT INTO order_events (order_id, status, actor) VALUES (?,?,?)`, [id, 'created', 'user']);

  if (usdAmt > 1000) {
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      'system',
      'travel_rule',
      'order ' + publicId,
      'Сумма > $1 000 — данные отправителя/получателя переданы контрагенту',
    ]);
  }

  if (risk > 70) {
    await transitionOrder(id, 'on_hold_compliance', 'system', 'Высокий риск адреса получателя (скрининг AML)');
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      'system',
      'aml_alert',
      'order ' + publicId,
      'risk ' + risk,
    ]);
    await notifyAdminTelegram(
      `🚩 <b>AML-холд</b>\nЗаявка ${publicId}: ${u.email}, ${amt} ${from} → ${to}, risk ${risk}.\nТребуется проверка в /admin/orders.`
    ).catch(() => {});
  } else if (payFromBalance) {
    // Deduct at most what's actually there — amt can be a hair above the
    // stored balance due to float noise even after the roundCoin comparison
    // above (e.g. balance 0.00139999999999999 vs requested 0.0014), and
    // subtracting the literal `amt` in that case would leave a tiny
    // negative dust balance instead of a clean zero.
    const debit = Math.min(amt, balance);
    await dbBatch([{ sql: `UPDATE balances SET amount = amount - ? WHERE user_id=? AND currency=?`, args: [debit, u.id, from] }]);
    await transitionOrder(id, 'paid', 'system', 'Списано с баланса');
    // no setTimeout here — advanceOrder() (time-based) picks this up on the
    // next poll of GET /api/orders/[id], which the client does every 1.5s
  } else {
    await transitionOrder(id, 'awaiting_payment', 'system');
  }

  return NextResponse.json({ id, publicId });
}
