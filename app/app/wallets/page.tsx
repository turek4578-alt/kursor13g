'use client';
import { CoinIcon } from '@/components/icons';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, usd } from '@/lib/format';

type Wallet = { coin: string; network: string; address: string; balance: number };

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({ USDT: 1, USDC: 1 });

  useEffect(() => {
    api('/api/wallets').then((d) => setWallets(d.wallets));
    api('/api/pairs').then((d) => {
      const map: Record<string, number> = { USDT: 1, USDC: 1 };
      for (const p of d.pairs) if (p.to === 'USDT') map[p.from] = p.partnerRate;
      setPrices(map);
    });
  }, []);

  return (
    <>
      <div className="topbar"><div className="title">Кошельки</div></div>
      <div className="page">
        <p className="small muted" style={{ marginBottom: 10 }}>
          Адреса выделены лично вам. Пополнение зачисляется после подтверждений сети.
        </p>
        <div className="card" style={{ padding: '4px 16px' }}>
          {wallets.map((w) => (
            <Link key={w.coin} href={`/app/wallets/${w.coin}`} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
              <CoinIcon coin={w.coin} size={36} />
              <div className="grow">
                <div className="t1">{w.coin} <span className="small muted" style={{ fontWeight: 500 }}>· {w.network}</span></div>
                <div className="t2 mono">{w.address}</div>
              </div>
              <div>
                <div className="amt">{fmt(w.balance, w.coin)}</div>
                <div className="small muted" style={{ textAlign: 'right' }}>{usd(w.balance * (prices[w.coin] || 0))}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
