import { NextRequest, NextResponse } from 'next/server';
import { getPriceHistory, COINGECKO_IDS } from '@/lib/priceFeed';

export async function GET(req: NextRequest) {
  const coin = req.nextUrl.searchParams.get('coin') || '';
  const daysParam = req.nextUrl.searchParams.get('days') || '7';
  const days = [1, 7, 30].includes(Number(daysParam)) ? Number(daysParam) : 7;

  if (!COINGECKO_IDS[coin]) {
    return NextResponse.json({ error: 'Неизвестная монета' }, { status: 400 });
  }
  const points = await getPriceHistory(coin, days);
  return NextResponse.json({ coin, days, points });
}
