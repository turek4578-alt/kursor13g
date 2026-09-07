'use client';
import { useState } from 'react';

export const Icon = {
  home: (
    <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /></svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24"><path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3" /></svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24"><path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V5a2 2 0 0 1 2-2h11v4M16 14h5" /></svg>
  ),
  hist: (
    <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></svg>
  ),
  user: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  withdraw: (
    <svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6M5 21h14" /></svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21.5 4.5 2.7 11.9c-1.2.5-1.2 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.3c.4-1.3-.3-1.9-1.8-1.5zM8.4 14.2l9-5.7c.4-.3.8-.1.5.2l-7.4 6.7-.3 3.3-1.3-3.5z"/></svg>
  ),
};

const COIN_FILES: Record<string, string> = {
  USDT: '/coins/usdt.svg',
  USDC: '/coins/usdc.svg',
  ETH: '/coins/eth.svg',
  BTC: '/coins/btc.svg',
  SOL: '/coins/sol.svg',
  TON: '/coins/ton.png',
  TRX: '/coins/trx.svg',
};

// Real token logos (from the widely-used open-source cryptocurrency-icons /
// Trust Wallet assets sets) — falls back to the old colored-letter circle
// if a coin has no icon file or the image fails to load, so nothing ever
// renders broken.
export function CoinIcon({ coin, size = 32 }: { coin: string; size?: number }) {
  const src = COIN_FILES[coin];
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={`ic ic-${coin}`}
        style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.36, flex: 'none' }}
      >
        {coin[0]}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={coin}
      width={size}
      height={size}
      style={{ borderRadius: '50%', flex: 'none', display: 'block' }}
      onError={() => setFailed(true)}
    />
  );
}

export function CoinChip({ c }: { c: string }) {
  return (
    <span className="coin">
      <CoinIcon coin={c} size={24} />
      {c}
    </span>
  );
}
