'use client';
import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CoinIcon } from '@/components/icons';
import PriceChart from '@/components/PriceChart';
import { api } from '@/lib/api';
import { usd } from '@/lib/format';

const RANGES: { days: number; label: string }[] = [
  { days: 1, label: '24ч' },
  { days: 7, label: '7д' },
  { days: 30, label: '30д' },
];

export default function RatePage({ params }: { params: Promise<{ coin: string }> }) {
  const { coin } = usePromise(params);
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [points, setPoints] = useState<[number, number][] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setPoints(null);
    setErr('');
    api(`/api/coin-history?coin=${coin}&days=${days}`)
      .then((d) => setPoints(d.points || []))
      .catch((e) => setErr(e.message));
  }, [coin, days]);

  const first = points?.[0]?.[1];
  const last = points?.[points.length - 1]?.[1];
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app')}>‹</button>
        <div className="title">{coin}</div>
      </div>
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <CoinIcon coin={coin} size={44} />
          </div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>
            {last !== undefined ? usd(last) : '…'}
          </div>
          {changePct !== null && (
            <div className="small" style={{ color: changePct >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% за период
            </div>
          )}
        </div>

        <div className="card">
          {err && <div className="err">{err}</div>}
          {!err && points === null && (
            <div style={{ height: 160, display: 'grid', placeItems: 'center', color: '#7c8b84', fontSize: 13 }}>Загрузка графика…</div>
          )}
          {!err && points !== null && <PriceChart points={points} />}

          <div className="row" style={{ marginTop: 14, gap: 8, justifyContent: 'center' }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`btn xs ${days === r.days ? '' : 'ghost'}`}
                style={{ width: 'auto' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <Link href="/app/exchange" className="btn amber" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
          Обменять {coin}
        </Link>

        <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
          Данные — CoinGecko, обновляются раз в несколько минут.
        </p>
      </div>
    </>
  );
}
