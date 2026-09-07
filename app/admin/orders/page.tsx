'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt, dt, usd, STATUS_RU_CLIENT } from '@/lib/format';

type Order = {
  id: string; public_id: string; user_name: string; user_email: string; user_level: number;
  from_currency: string; to_currency: string; amount_from: number; amount_to: number;
  rate: number; partner_rate: number; spread_usd: number; status: string; dest: string;
  payout_address: string | null; deposit_address: string | null; tx_in: string | null; tx_out: string | null; risk_score: number;
  created_at: string; events: any[];
};

const TABS: [string, string][] = [
  ['action', 'Требуют действия'],
  ['all', 'Все'],
  ['awaiting_payment', 'Ожидают оплаты'],
  ['processing', 'Исполняются'],
  ['completed', 'Выполнены'],
  ['on_hold_compliance', 'Hold'],
  ['payment_review', 'Проверка оплаты'],
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState('action');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const d = await api('/api/admin/orders');
    setOrders(d.orders);
  }
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const filtered = orders.filter((o) => {
    if (tab === 'all') return true;
    if (tab === 'action') return ['on_hold_compliance', 'refund_pending', 'failed', 'payment_detected', 'payment_review'].includes(o.status);
    return o.status === tab;
  });

  async function act(orderId: string, to: string) {
    const reason = prompt('Комментарий (обязателен):');
    if (!reason) return;
    try {
      await api('/api/admin/orders', { method: 'POST', body: JSON.stringify({ orderId, to, reason }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Заявки</h1>
          <div className="small muted">{orders.length} всего</div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th><th>Время</th><th>Пользователь</th><th>Пара</th><th>Сумма</th><th>Спред</th><th>Риск</th><th>Статус</th><th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 30 }}>Пусто</td></tr>
            )}
            {filtered.map((o) => (
              <>
                <tr key={o.id}>
                  <td className="mono">{o.public_id}</td>
                  <td className="mono small">{dt(o.created_at)}</td>
                  <td>{o.user_name}<div className="small muted">L{o.user_level}</div></td>
                  <td className="mono">{o.from_currency}→{o.to_currency}</td>
                  <td className="mono">{fmt(o.amount_from, o.from_currency)}</td>
                  <td className="mono small">{usd(o.spread_usd)}</td>
                  <td><span className={`st ${o.risk_score > 70 ? 'st-blocked' : o.risk_score > 40 ? 'st-pending' : 'st-approved'}`}>{o.risk_score}</span></td>
                  <td><span className={`st st-${o.status}`}>{STATUS_RU_CLIENT[o.status]}</span></td>
                  <td>
                    <div className="acts">
                      {o.status === 'on_hold_compliance' && (
                        <>
                          <button className="btn xs green" onClick={() => act(o.id, 'processing')}>Одобрить</button>
                          <button className="btn xs danger" onClick={() => act(o.id, 'refund_pending')}>Возврат</button>
                        </>
                      )}
                      {o.status === 'payment_review' && (
                        <>
                          <button className="btn xs green" onClick={() => act(o.id, 'paid')}>Подтвердить оплату</button>
                          <button className="btn xs danger" onClick={() => act(o.id, 'cancelled')}>Отклонить</button>
                        </>
                      )}
                      {['paid', 'processing', 'awaiting_payment', 'payment_detected', 'payment_review'].includes(o.status) && (
                        <button className="btn xs" style={{ background: 'var(--hold-bg)', color: 'var(--hold)' }} onClick={() => act(o.id, 'on_hold_compliance')}>Hold</button>
                      )}
                      {o.status === 'refund_pending' && (
                        <button className="btn xs blue" onClick={() => act(o.id, 'refunded')}>Возврат выполнен</button>
                      )}
                      {o.status === 'failed' && (
                        <button className="btn xs blue" onClick={() => act(o.id, 'processing')}>Повторить</button>
                      )}
                      <button className="btn xs ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                        {expanded === o.id ? 'Скрыть' : 'События'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr>
                    <td colSpan={9} style={{ background: '#F7F9FB' }}>
                      <div className="small" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          {o.status === 'payment_review' && (
                            <>
                              <b>Адрес приёма (сверьте в эксплорере):</b> <span className="mono">{o.deposit_address}</span><br />
                              <b>Ожидалось:</b> <span className="mono">{fmt(o.amount_from, o.from_currency)} {o.from_currency}</span><br />
                            </>
                          )}
                          <b>Получатель:</b> <span className="mono">{o.dest === 'internal' ? 'баланс' : o.payout_address}</span><br />
                          <b>Курс:</b> <span className="mono">{fmt(o.rate)}</span> (партнёр {fmt(o.partner_rate)})<br />
                          <b>Tx in:</b> <span className="mono">{o.tx_in || '—'}</span><br />
                          <b>Tx out:</b> <span className="mono">{o.tx_out || '—'}</span>
                        </div>
                        <ul className="tl">
                          {o.events.map((e: any, i: number) => (
                            <li key={i} className="on">
                              <div>
                                <b>{STATUS_RU_CLIENT[e.status]}</b> <span className="muted">· {e.actor}</span>
                                {e.reason && <div className="muted">{e.reason}</div>}
                                <div className="when">{dt(e.created_at)}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
