'use client';
import { CoinIcon } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe } from './useMe';
import { api } from '@/lib/api';
import { STATUS_RU_CLIENT, fmt, usd } from '@/lib/format';

type Order = {
  id: string; public_id: string; from_currency: string; to_currency: string;
  amount_to: number; status: string; created_at: string;
};

const COIN_LIST = ['ETH', 'BTC', 'SOL', 'TON'];

export default function HomePage() {
  const { me, loading } = useMe();
  const [orders, setOrders] = useState<Order[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [killSwitch, setKillSwitch] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    api('/api/messages').then((d) => setMessages((d.messages || []).filter((m: any) => !m.read_at)));
  }, []);

  async function dismissMessage(id: string) {
    await api('/api/messages', { method: 'POST', body: JSON.stringify({ id }) });
    setMessages((m) => m.filter((x) => x.id !== id));
  }

  useEffect(() => {
    api('/api/orders').then((d) => setOrders(d.orders.slice(0, 3))).catch(() => {});
    async function loadRates() {
      const d = await api('/api/pairs');
      setKillSwitch(d.killSwitch);
      const map: Record<string, number> = {};
      for (const p of d.pairs) if (p.to === 'USDT' && COIN_LIST.includes(p.from)) map[p.from] = p.partnerRate;
      setRates(map);
    }
    loadRates();
    const t = setInterval(loadRates, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading || !me) return <div className="topbar"><div className="logo"><LogoMark />KURS</div></div>;

  const total = Object.entries(me.balances).reduce((s, [c, v]) => s + v * (c === 'USDT' || c === 'USDC' ? 1 : (rates[c] || 0)), 0);
  const nonZero = Object.entries(me.balances).filter(([, v]) => v > 0);

  return (
    <>
      <div className="topbar">
        <div className="logo"><LogoMark />KURS</div>
      </div>
      <div className="page">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Здравствуйте,</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{me.name}</div>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 999,
              background: 'rgba(0,217,107,.1)', border: '1px solid var(--amber)', color: 'var(--amber)',
              boxShadow: '0 0 14px rgba(0,217,107,.28)',
            }}
          >
            KYC · уровень {me.kycLevel}
          </span>
        </div>

        {messages.map((m) => (
          <div key={m.id} className="banner blue" style={{ alignItems: 'flex-start' }}>
            <span>{m.message}</span>
            <button className="link" style={{ flex: 'none', color: 'var(--blue)' }} onClick={() => dismissMessage(m.id)}>Прочитано</button>
          </div>
        ))}

        {me.kycStatus !== 'approved' && (
          <Link
            href="/app/kyc"
            className="tap"
            style={{
              textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              background: 'rgba(0,217,107,.08)', border: '1px solid var(--amber)', color: 'var(--amber)',
              borderRadius: 12, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, marginBottom: 12,
              boxShadow: '0 0 20px rgba(0,217,107,.18)',
            }}
          >
            <span>
              {me.kycStatus === 'none' && 'Пройдите верификацию, чтобы снять лимит $1 000'}
              {me.kycStatus === 'pending' && 'Документы на проверке — обычно до 10 минут'}
              {me.kycStatus === 'rejected' && 'Верификация отклонена. Загрузите документ заново'}
            </span>
            <span>›</span>
          </Link>
        )}
        {killSwitch && <div className="banner red">Обмен временно приостановлен. Средства в безопасности.</div>}

        <div className="card dark">
          <div className="eyebrow" style={{ color: '#7c8b84' }}>Баланс на платформе</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 600, margin: '4px 0 12px' }}>{usd(total)}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nonZero.length ? (
              nonZero.map(([c, v]) => (
                <span key={c} className="pill" style={{ background: '#16211b', border: '1px solid #2a3a31', borderRadius: 999, padding: '4px 10px', color: '#fff', fontSize: 12.5 }}>
                  {c} {fmt(v, c)}
                </span>
              ))
            ) : (
              <span className="small" style={{ color: '#7c8b84' }}>Пока пусто — пополните кошелёк</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Link href="/app/exchange" className="btn amber" style={{ textDecoration: 'none' }}>Обменять</Link>
          <Link href="/app/wallets" className="btn ghost" style={{ textDecoration: 'none' }}>Пополнить</Link>
        </div>

        <h2>Курсы сейчас</h2>
        <div className="card" style={{ padding: '4px 16px' }}>
          {COIN_LIST.map((c) => (
            <Link key={c} href={`/app/rates/${c}`} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
              <CoinIcon coin={c} size={30} />
              <div className="grow">
                <div className="t1">{c}</div>
              </div>
              <div className="amt">{rates[c] ? usd(rates[c]) : '…'}</div>
            </Link>
          ))}
        </div>

        {orders.length > 0 && (
          <>
            <h2>Последние операции</h2>
            <div className="card" style={{ padding: '4px 16px' }}>
              {orders.map((o) => (
                <Link key={o.id} href={`/app/orders/${o.id}`} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <CoinIcon coin={o.to_currency} size={34} />
                  <div className="grow">
                    <div className="t1">{o.from_currency} → {o.to_currency}</div>
                    <div className="t2">{new Date(o.created_at).toLocaleString('ru-RU')} · {o.public_id}</div>
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
          </>
        )}
      </div>
    </>
  );
}
