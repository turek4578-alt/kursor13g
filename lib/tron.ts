// USDT (TRC20) contract address on Tron mainnet — this is the real,
// well-known contract. Do not change unless you actually mean a different
// token.
export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export function isValidTronAddress(address: string): boolean {
  // Base58Check, starts with 'T', exactly 34 characters, base58 alphabet only
  // (no 0, O, I, l). This is a format check only — it does not confirm the
  // address exists on-chain, just that it isn't obviously garbage (like a
  // placeholder string of repeated digits).
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export type Trc20Transfer = {
  transactionId: string;
  from: string;
  to: string;
  value: string; // raw integer string, 6 decimals for USDT
  blockTimestamp: number;
};

// Reads TRC20 transfer history for one address directly from TronGrid's
// public HTTP API — no node operation of our own needed. TronGrid is
// Tron's official, free indexing API; an optional API key (TRON_PRO_API_KEY)
// raises the rate limit but isn't required to function.
//
// NOTE: this call is written against TronGrid's documented API but has not
// been exercised against the live network from this environment (no
// outbound network access in the build sandbox) — verify it against a real
// deposit after deploying, per the README.
export async function getTrc20Transfers(address: string): Promise<Trc20Transfer[]> {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=50&contract_address=${USDT_TRC20_CONTRACT}&only_to=true`;
  const headers: Record<string, string> = {};
  if (process.env.TRON_PRO_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRON_PRO_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TronGrid error ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((t: any) => ({
    transactionId: t.transaction_id,
    from: t.from,
    to: t.to,
    value: t.value,
    blockTimestamp: t.block_timestamp,
  }));
}

export function fromTrc20Units(raw: string): number {
  return Number(raw) / 1_000_000; // USDT TRC20 uses 6 decimals
}
