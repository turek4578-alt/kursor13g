'use client';
import { CoinIcon } from '@/components/icons';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, usd } from '@/lib/format';

type Wallet = { coin: string; network: string; balance: number };

export default function WithdrawListPage() {
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

  const withBalance = wallets.filter((w) => w.balance > 0);
  const empty = wallets.filter((w) => w.balance <= 0);

  return (
    <>
      <div className="topbar"><div className="title">Вывод</div></div>
      <div className="page">
        <p className="small muted" style={{ marginBottom: 10 }}>
          Выберите монету, чтобы вывести на внешний кошелёк. Доступны только монеты с ненулевым балансом.
        </p>

        {withBalance.length > 0 && (
          <div className="card" style={{ padding: '4px 16px' }}>
            {withBalance.map((w) => (
              <Link key={w.coin} href={`/app/withdraw/${w.coin}`} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
                <CoinIcon coin={w.coin} size={36} />
                <div className="grow">
                  <div className="t1">{w.coin} <span className="small muted" style={{ fontWeight: 500 }}>· {w.network}</span></div>
                </div>
                <div>
                  <div className="amt">{fmt(w.balance, w.coin)}</div>
                  <div className="small muted" style={{ textAlign: 'right' }}>{usd(w.balance * (prices[w.coin] || 0))}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {empty.length > 0 && (
          <div className="card" style={{ padding: '4px 16px', opacity: 0.4 }}>
            {empty.map((w) => (
              <div key={w.coin} className="li" style={{ cursor: 'default' }}>
                <CoinIcon coin={w.coin} size={36} />
                <div className="grow">
                  <div className="t1">{w.coin} <span className="small muted" style={{ fontWeight: 500 }}>· {w.network}</span></div>
                </div>
                <div className="amt">0</div>
              </div>
            ))}
          </div>
        )}

        {withBalance.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontWeight: 700 }}>Пока нечего выводить</div>
            <div className="small muted" style={{ margin: '6px 0 14px' }}>Сделайте обмен или пополните баланс.</div>
            <Link href="/app/exchange" className="btn sm amber" style={{ textDecoration: 'none', display: 'inline-flex' }}>Обменять</Link>
          </div>
        )}
      </div>
    </>
  );
}
