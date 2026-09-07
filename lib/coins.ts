export const COINS: Record<string, { name: string; net: string; dec: number; basePrice: number }> = {
  USDT: { name: 'Tether', net: 'TRC20', dec: 2, basePrice: 1.0 },
  USDC: { name: 'USD Coin', net: 'ERC20', dec: 2, basePrice: 0.9998 },
  ETH: { name: 'Ethereum', net: 'ERC20', dec: 5, basePrice: 3418.4 },
  BTC: { name: 'Bitcoin', net: 'Bitcoin', dec: 6, basePrice: 68240 },
  SOL: { name: 'Solana', net: 'Solana', dec: 3, basePrice: 164.7 },
  TON: { name: 'Toncoin', net: 'TON', dec: 3, basePrice: 5.82 },
  TRX: { name: 'Tron', net: 'TRC20', dec: 1, basePrice: 0.1284 },
};

// Deterministic pseudo-live price: drifts slowly based on time, same for
// every viewer (no randomness that would desync clients). This is the
// fallback used only if the real price feed (lib/priceFeed.ts) is
// unavailable and there is no cached price at all yet.
export function livePrice(coin: string, atMs: number = Date.now()): number {
  const c = COINS[coin];
  if (!c) return 0;
  if (coin === 'USDT') return 1;
  const t = atMs / 90000; // wave period ~90s buckets
  const seedNum = [...coin].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const wave = Math.sin(t + seedNum) * 0.006 + Math.sin(t * 0.37 + seedNum * 2) * 0.003;
  return c.basePrice * (1 + wave);
}

// Single source of truth for "what is this coin worth right now" given a
// possibly-incomplete real-price map. Never falls back to a flat $1 — if
// the live feed is missing a coin (feed down, that id not returned by this
// poll, etc.) we fall back to the coin's own live-ish drifting price
// instead, so a temporary feed gap never freezes a coin at an obviously
// wrong fixed value. USDT/USDC still default to ~$1 only because that is
// actually their real peg, not because it's a generic fallback.
export function priceOrFallback(prices: Record<string, number>, coin: string): number {
  if (prices[coin] !== undefined) return prices[coin];
  return coin === 'USDT' || coin === 'USDC' ? 1 : livePrice(coin);
}

// Crypto amounts computed through division/multiplication (rate math,
// spread math) come out of IEEE-754 floating point with long tails —
// 3.5 * someRate can land on 0.0013999999999999999 instead of a clean
// 0.0014. Rounding every amount that gets stored or compared to 8 decimal
// places (enough precision for any of this app's coins, satoshi-level for
// BTC) keeps balances clean and stops those tails from causing a balance
// that's "morally" enough to pay for an order from comparing as short by
// a fraction of a billionth of a unit.
export function roundCoin(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 1e8) / 1e8;
}

export async function rateForReal(from: string, to: string, spreadBps: number) {
  const { getRealPrices } = await import('./priceFeed');
  const prices = await getRealPrices();
  const priceOf = (coin: string) => priceOrFallback(prices, coin);
  const raw = priceOf(from) / priceOf(to);
  const our = raw * (1 - spreadBps / 10000);
  return { raw, our, priceFrom: priceOf(from), priceTo: priceOf(to) };
}

export function rateFor(from: string, to: string, spreadBps: number, atMs?: number) {
  const raw = livePrice(from, atMs) / livePrice(to, atMs);
  const our = raw * (1 - spreadBps / 10000);
  return { raw, our };
}

export function fmt(n: number, coin?: string): string {
  const dec = coin && COINS[coin] ? COINS[coin].dec : 2;
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: dec });
}

export function usd(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export const STATUS_RU: Record<string, string> = {
  created: 'Создана',
  awaiting_payment: 'Ожидает оплаты',
  payment_detected: 'Платёж обнаружен',
  payment_review: 'Проверяется администратором',
  paid: 'Оплачена',
  processing: 'Исполняется',
  completed: 'Выполнена',
  expired: 'Истекла',
  cancelled: 'Отменена',
  on_hold_compliance: 'На проверке',
  refund_pending: 'Возврат',
  refunded: 'Возвращена',
  failed: 'Ошибка',
  pending: 'На проверке',
  approved: 'Подтверждён',
  rejected: 'Отклонён',
  none: 'Не пройден',
  active: 'Активен',
  blocked: 'Заблокирован',
};

const HEX = '0123456789abcdef';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function seedRng(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Deterministic per-user, per-coin deposit address. NOTE: these are
// display-only addresses for the prototype — no keys exist, nothing must
// ever be sent to them. Real HD-wallet address generation is a sprint-4/10
// item once a custody or execution-provider integration exists.
export function addressFor(seed: string, coin: string): string {
  const c = COINS[coin];
  if (!c) return '';
  const r = seedRng(seed + ':' + coin);
  const pick = (alphabet: string, n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
  if (c.net === 'TRC20') return 'T' + pick(B58, 33);
  if (c.net === 'ERC20') return '0x' + pick(HEX, 40);
  if (c.net === 'Bitcoin') return 'bc1q' + pick(B32, 38);
  if (c.net === 'Solana') return pick(B58, 44);
  if (c.net === 'TON') return 'UQ' + pick(B58, 46);
  return '0x' + pick(HEX, 40);
}

export function txHash(seed: string): string {
  const r = seedRng(seed);
  return '0x' + Array.from({ length: 64 }, () => HEX[Math.floor(r() * 16)]).join('');
}

export function shortOrderId(): string {
  return 'KX-' + Math.floor(10000 + Math.random() * 89999);
}
