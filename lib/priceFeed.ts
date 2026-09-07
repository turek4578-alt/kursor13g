import { COINS } from './coins';

// Real market prices from CoinGecko's public API (no key required, generous
// free rate limit). Cached in memory for CACHE_MS so that many client polls
// (the app refreshes /api/pairs every 5s per open tab) don't each trigger an
// external call — only one real fetch happens per cache window, shared by
// every request that lands on this warm server instance.
//
// NOTE: this was written against CoinGecko's documented API but has not
// been exercised against the live network from the build environment (no
// outbound internet there) — verify actual numbers after deploying.

export const COINGECKO_IDS: Record<string, string> = {
  USDT: 'tether',
  USDC: 'usd-coin',
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  TON: 'the-open-network',
  TRX: 'tron',
};

const CACHE_MS = 20_000;

declare global {
  // eslint-disable-next-line no-var
  var __kursPriceCache: { at: number; prices: Record<string, number> } | undefined;
}

async function fetchFromCoinGecko(): Promise<Record<string, number>> {
  const ids = Object.values(COINGECKO_IDS).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);
  const data = await res.json();
  const out: Record<string, number> = {};
  for (const [coin, id] of Object.entries(COINGECKO_IDS)) {
    const p = data[id]?.usd;
    if (typeof p === 'number' && p > 0) out[coin] = p;
  }
  return out;
}

// Falls back to the last successfully fetched price, and only if there has
// never been a successful fetch does it fall back further to the coin's
// static basePrice from lib/coins.ts (so the site never shows $0 or crashes
// if the price feed is briefly unreachable, it just shows slightly stale —
// clearly preferable to breaking the calculator).
export async function getRealPrices(): Promise<Record<string, number>> {
  const cache = global.__kursPriceCache;
  const fresh = cache && Date.now() - cache.at < CACHE_MS;
  if (fresh) return cache!.prices;

  try {
    const prices = await fetchFromCoinGecko();
    const merged = { ...(cache?.prices || {}), ...prices };
    global.__kursPriceCache = { at: Date.now(), prices: merged };
    return merged;
  } catch (e) {
    if (cache) return cache.prices; // serve stale rather than fail
    // no cache at all yet (first request ever failed) — static fallback
    const fallback: Record<string, number> = {};
    for (const c of Object.keys(COINS)) fallback[c] = COINS[c].basePrice;
    return fallback;
  }
}

// Historical price series for the rate-detail chart, from CoinGecko's
// public market_chart endpoint — same free tier, no API key. Cached
// per (coin, days) pair for a few minutes since chart history doesn't need
// to be as fresh as the live ticker price.
declare global {
  // eslint-disable-next-line no-var
  var __kursHistoryCache: Record<string, { at: number; points: [number, number][] }> | undefined;
}
const HISTORY_CACHE_MS = 3 * 60_000;

export async function getPriceHistory(coin: string, days: number): Promise<[number, number][]> {
  const id = COINGECKO_IDS[coin];
  if (!id) return [];
  const key = `${coin}:${days}`;
  if (!global.__kursHistoryCache) global.__kursHistoryCache = {};
  const cached = global.__kursHistoryCache[key];
  if (cached && Date.now() - cached.at < HISTORY_CACHE_MS) return cached.points;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`CoinGecko history error ${res.status}`);
    const data = await res.json();
    const points: [number, number][] = Array.isArray(data.prices) ? data.prices : [];
    global.__kursHistoryCache[key] = { at: Date.now(), points };
    return points;
  } catch {
    if (cached) return cached.points; // serve stale rather than fail
    return [];
  }
}
