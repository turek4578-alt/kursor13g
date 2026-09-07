'use client';
import { CoinIcon } from '@/components/icons';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, dt, STATUS_RU_CLIENT } from '@/lib/format';

type Order = {
  id: string; public_id: string; from_currency: string; to_currency: string;
  amount_to: number; status: string; created_at: string;
};

const TABS: [string, string][] = [
  ['all', 'Все'],
  ['active', 'Активные'],
  ['completed', 'Выполненные'],
  ['on_hold_compliance', 'На проверке'],
];
const FINAL = ['completed', 'expired', 'cancelled', 'refunded', 'failed'];

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    api('/api/orders').then((d) => setOrders(d.orders));
  }, []);

  const filtered = orders.filter((o) => {
    if (tab === 'all') return true;
    if (tab === 'active') return !FINAL.includes(o.status);
    return o.status === tab;
  });

  return (
    <>
      <div className="topbar"><div className="title">История</div></div>
      <div className="page">
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {filtered.length ? (
          <div className="card" style={{ padding: '4px 16px' }}>
            {filtered.map((o) => (
              <Link key={o.id} href={`/app/orders/${o.id}`} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
                <CoinIcon coin={o.to_currency} size={34} />
                <div className="grow">
                  <div className="t1">{o.from_currency} → {o.to_currency}</div>
                  <div className="t2">{dt(o.created_at)} · {o.public_id}</div>
                </div>
                <div>
                  <div className="amt">+{fmt(o.amount_to, o.to_currency)} {o.to_currency}</div>
                  <div style={{ textAlign: 'right', marginTop: 3 }}>
                    <span className={`st st-${o.status}`}>{STATUS_RU_CLIENT[o.status]}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontWeight: 700 }}>Пока нет операций</div>
            <div className="small muted" style={{ margin: '6px 0 14px' }}>Первый обмен займёт пару минут.</div>
            <Link href="/app/exchange" className="btn sm amber" style={{ textDecoration: 'none', display: 'inline-flex' }}>Обменять</Link>
          </div>
        )}
      </div>
    </>
  );
}
