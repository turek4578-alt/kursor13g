import { NextResponse } from 'next/server';
import { dbAll, dbGet } from '@/lib/db';
import { getRealPrices } from '@/lib/priceFeed';
import { priceOrFallback } from '@/lib/coins';

export async function GET() {
  const pairs = await dbAll(`SELECT * FROM pairs`);
  const killRow = await dbGet(`SELECT value FROM settings WHERE key = 'kill_switch'`);
  const kill = killRow?.value === '1';
  const prices = await getRealPrices();
  const now = Date.now();
  const out = pairs.map((p) => {
    const priceFrom = priceOrFallback(prices, p.from_currency);
    const priceTo = priceOrFallback(prices, p.to_currency);
    const raw = priceFrom / priceTo;
    const our = raw * (1 - p.spread_bps / 10000);
    return {
      from: p.from_currency,
      to: p.to_currency,
      enabled: !!p.enabled && !kill,
      spreadBps: p.spread_bps,
      minUsd: p.min_usd,
      maxUsd: p.max_usd,
      rate: our,
      partnerRate: raw,
    };
  });
  return NextResponse.json({ pairs: out, killSwitch: kill, serverTime: now, prices });
}
