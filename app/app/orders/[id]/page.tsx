'use client';
import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { fmt, fmtRate, dt, STATUS_RU_CLIENT } from '@/lib/format';
import { toast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';

type Order = {
  id: string; public_id: string; from_currency: string; to_currency: string;
  amount_from: number; amount_to: number; rate: number; partner_rate: number;
  status: string; dest: string; payout_address: string | null; deposit_address: string | null;
  tx_in: string | null; tx_out: string | null; expires_at: string; created_at: string;
  events: { status: string; actor: string; reason: string | null; created_at: string }[];
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await api(`/api/orders/${id}`);
        if (!stop) setOrder(data.order);
      } catch {}
    }
    load();
    const t = setInterval(load, 1500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!order) {
    return (
      <>
        <div className="topbar"><button className="back" onClick={() => router.back()}>‹</button><div className="title">Заявка</div></div>
        <div className="page" />
      </>
    );
  }

  const secondsLeft = Math.max(0, Math.floor((new Date(order.expires_at).getTime() - now) / 1000));
  const steps = ['created', 'awaiting_payment', 'payment_detected', 'paid', 'processing', 'completed'];
  const finalStates = ['completed', 'expired', 'cancelled', 'refunded', 'failed'];

  async function iPaid() {
    setBusy(true);
    try {
      const data = await api(`/api/orders/${id}`, { method: 'POST', body: JSON.stringify({ action: 'i_paid' }) });
      setOrder(data.order);
    } catch {}
    setBusy(false);
  }
  async function cancel() {
    setBusy(true);
    try {
      const data = await api(`/api/orders/${id}`, { method: 'POST', body: JSON.stringify({ action: 'cancel' }) });
      setOrder(data.order);
    } catch {}
    setBusy(false);
  }

  const circumference = 364;
  const pct = secondsLeft / (15 * 60);

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app')}>‹</button>
        <div className="title">Заявка {order.public_id}</div>
      </div>
      <div className="page">
        <div className="card">
          {order.status === 'awaiting_payment' && (
            <>
              <div className="ring">
                <svg width="132" height="132">
                  <circle cx="66" cy="66" r="58" stroke="#223028" strokeWidth="8" fill="none" />
                  <circle cx="66" cy="66" r="58" stroke="#00d96b" strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} strokeLinecap="round" />
                </svg>
                <div className="t">
                  {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                  <small>КУРС ЗАФИКСИРОВАН</small>
                </div>
              </div>
              <p style={{ textAlign: 'center', fontWeight: 700 }}>
                Переведите <span className="mono">{fmt(order.amount_from, order.from_currency)} {order.from_currency}</span>
              </p>
              <p className="small muted" style={{ textAlign: 'center', marginBottom: 12 }}>на адрес ниже</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}>
                  <QRCodeSVG value={order.deposit_address || ''} size={168} />
                </div>
              </div>
              <div className="addr" style={{ textAlign: 'center' }}>{order.deposit_address}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm ghost" onClick={async () => toast((await copyText(order.deposit_address || '')) ? 'Адрес скопирован' : 'Не удалось скопировать — выделите адрес вручную')}>Скопировать адрес</button>
                <button className="btn sm blue" disabled={busy} onClick={iPaid}>Я перевёл</button>
              </div>
            </>
          )}

          {order.status === 'completed' && (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 10px', fontSize: 30 }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Обмен выполнен</div>
              <div className="muted small">{order.dest === 'internal' ? 'Зачислено на баланс KURS' : 'Отправлено на ваш кошелёк'}</div>
            </div>
          )}

          {order.status === 'on_hold_compliance' && (
            <div className="banner">Заявка на ручной проверке комплаенс. Обычно до 2 часов. Средства в безопасности.</div>
          )}

          {order.status === 'payment_review' && (
            <div className="banner">Проверяем ваш перевод вручную. Обычно занимает до 30 минут — как только администратор подтвердит поступление, заявка продолжится автоматически.</div>
          )}

          {finalStates.includes(order.status) && order.status !== 'completed' && (
            <div className="banner red">
              {STATUS_RU_CLIENT[order.status]}. {order.status === 'expired' ? 'Создайте новую заявку — курс обновился.' : ''}
            </div>
          )}

          {!finalStates.includes(order.status) && order.status !== 'awaiting_payment' && order.status !== 'on_hold_compliance' && order.status !== 'payment_review' && (
            <div style={{ textAlign: 'center', padding: '18px 0' }}>
              <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '.1em' }}>ИСПОЛНЯЕТСЯ</div>
              <div className="bar" style={{ margin: '12px auto', width: 200 }}>
                <i style={{ width: `${((steps.indexOf(order.status) + 1) / 6) * 100}%` }} />
              </div>
              <div className="small muted">
                Отправляем {order.to_currency} {order.dest === 'internal' ? 'на ваш баланс' : 'на ' + (order.payout_address || '').slice(0, 10) + '…'}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="small muted">Отдаёте</div>
              <b className="mono">{fmt(order.amount_from, order.from_currency)} {order.from_currency}</b>
            </div>
            <span style={{ fontSize: 20, color: '#B4BDCA' }}>→</span>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">Получаете</div>
              <b className="mono">{fmt(order.amount_to, order.to_currency)} {order.to_currency}</b>
            </div>
          </div>
          <div className="hr" />
          <div className="row small">
            <span className="muted">Курс</span>
            <b className="mono">1 {order.from_currency} = {fmtRate(order.rate)} {order.to_currency}</b>
          </div>
          <div className="row small" style={{ marginTop: 5 }}>
            <span className="muted">Получатель</span>
            <b className="mono" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {order.dest === 'internal' ? 'Баланс KURS' : order.payout_address}
            </b>
          </div>
          {order.tx_in && (
            <div className="row small" style={{ marginTop: 5 }}>
              <span className="muted">Входящий tx</span>
              <span className="mono" style={{ color: 'var(--blue)' }}>{order.tx_in.slice(0, 14)}…</span>
            </div>
          )}
          {order.tx_out && (
            <div className="row small" style={{ marginTop: 5 }}>
              <span className="muted">Исходящий tx</span>
              <span className="mono" style={{ color: 'var(--blue)' }}>{order.tx_out.slice(0, 14)}…</span>
            </div>
          )}
          <div className="row small" style={{ marginTop: 5 }}>
            <span className="muted">Статус</span>
            <span className={`st st-${order.status}`}>{STATUS_RU_CLIENT[order.status]}</span>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 8 }}>События</h3>
          <ul className="tl">
            {order.events.map((e, i) => (
              <li key={i} className={i < order.events.length - 1 ? 'on' : ''}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{STATUS_RU_CLIENT[e.status]}</div>
                  {e.reason && <div className="small muted">{e.reason}</div>}
                  <div className="when">{dt(e.created_at)} · {e.actor}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {order.status === 'awaiting_payment' && (
          <button className="btn ghost" disabled={busy} onClick={cancel}>Отменить заявку</button>
        )}
      </div>
    </>
  );
}
