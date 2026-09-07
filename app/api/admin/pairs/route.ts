import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { getRealPrices } from '@/lib/priceFeed';
import { priceOrFallback } from '@/lib/coins';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const pairs = await dbAll(`SELECT * FROM pairs`);
  const prices = await getRealPrices();
  const out = pairs.map((p) => {
    const priceFrom = priceOrFallback(prices, p.from_currency);
    const priceTo = priceOrFallback(prices, p.to_currency);
    const raw = priceFrom / priceTo;
    const our = raw * (1 - p.spread_bps / 10000);
    return { ...p, partnerRate: raw, ourRate: our };
  });
  return NextResponse.json({ pairs: out });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { id, spreadBps, enabled, minUsd } = await req.json();
  const p = await dbGet(`SELECT * FROM pairs WHERE id=?`, [id]);
  if (!p) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  if (spreadBps !== undefined) {
    const val = Math.max(0, Math.min(1000, Math.round(spreadBps)));
    await dbRun(`UPDATE pairs SET spread_bps=? WHERE id=?`, [val, id]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'pair_spread',
      `pair ${p.from_currency}→${p.to_currency}`,
      (val / 100).toFixed(2) + '%',
    ]);
  }
  if (enabled !== undefined) {
    await dbRun(`UPDATE pairs SET enabled=? WHERE id=?`, [enabled ? 1 : 0, id]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'pair_toggle',
      `pair ${p.from_currency}→${p.to_currency}`,
      enabled ? 'on' : 'off',
    ]);
  }
  if (minUsd !== undefined) {
    const val = Math.max(0, Number(minUsd) || 0);
    await dbRun(`UPDATE pairs SET min_usd=? WHERE id=?`, [val, id]);
    await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
      staff.email,
      'pair_min_usd',
      `pair ${p.from_currency}→${p.to_currency}`,
      '$' + val,
    ]);
  }
  return NextResponse.json({ ok: true });
}
