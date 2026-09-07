'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usd, STATUS_RU_CLIENT } from '@/lib/format';
import Link from 'next/link';

type Order = { id: string; public_id: string; from_currency: string; to_currency: string; amount_from: number; status: string; created_at: string; };

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [kill, setKill] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({ USDT: 1, USDC: 1 });

  async function load() {
    const o = await api('/api/admin/orders');
    setOrders(o.orders);
    const u = await api('/api/admin/users');
    setUsers(u.users);
    const k = await api('/api/admin/kill');
    setKill(k.killSwitch);
    const p = await api('/api/pairs');
    const map: Record<string, number> = { USDT: 1, USDC: 1 };
    for (const pr of p.pairs) if (pr.to === 'USDT') map[pr.from] = pr.partnerRate;
    setRates(map);
  }
  useEffect(() => { load(); }, []);

  const usdOf = (amt: number, coin: string) => amt * (rates[coin] || 0);
  const done = orders.filter((o) => o.status === 'completed');
  const turnover = done.reduce((s, o) => s + usdOf(o.amount_from, o.from_currency), 0);
  const day = Date.now() - 86400000;
  const todays = orders.filter((o) => new Date(o.created_at).getTime() > day);
  const byStatus: Record<string, number> = {};
  orders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
  const needsAction = orders.filter((o) => ['on_hold_compliance', 'refund_pending', 'failed', 'processing'].includes(o.status));
  const pendingKyc = users.filter((u) => u.kyc_status === 'pending');

  return (
    <>
      <div className="row" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Сводка</h1>
          <div className="small muted">За всё время</div>
        </div>
        {kill && <span className="st st-blocked">KILL SWITCH ВКЛЮЧЁН</span>}
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{usd(turnover)}</div><div className="l">оборот, всего</div></div>
        <div className="kpi"><div className="v">{todays.length}</div><div className="l">заявок за 24 ч</div></div>
        <div className="kpi"><div className="v">{orders.length ? Math.round((done.length / orders.length) * 100) : 0}%</div><div className="l">заявка → выполнена</div></div>
        <div className="kpi"><div className="v">{users.length}</div><div className="l">пользователей</div></div>
        <div className="kpi"><div className="v">{users.filter((u) => u.kyc_status === 'approved').length}</div><div className="l">с KYC</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Заявки по статусам</h3>
          {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <div key={s} className="row small" style={{ marginBottom: 6 }}>
              <span className={`st st-${s}`}>{STATUS_RU_CLIENT[s]}</span>
              <span className="mono">{n}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Требуют действия</h3>
          {needsAction.slice(0, 6).map((o) => (
            <Link key={o.id} href="/admin/orders" className="row small tap" style={{ marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
              <span className="mono">{o.public_id}</span>
              <span>{o.from_currency}→{o.to_currency}</span>
              <span className={`st st-${o.status}`}>{STATUS_RU_CLIENT[o.status]}</span>
            </Link>
          ))}
          {pendingKyc.map((u) => (
            <Link key={u.id} href="/admin/users" className="row small tap" style={{ marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
              <span>{u.name}</span>
              <span className="st st-pending">KYC</span>
            </Link>
          ))}
          {needsAction.length === 0 && pendingKyc.length === 0 && <div className="small muted">Очередь пуста</div>}
        </div>
      </div>
    </>
  );
}
