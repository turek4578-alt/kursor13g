'use client';
import { parseAmount } from '@/lib/parseAmount';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Calculator from '@/components/Calculator';
import { useMe } from '../useMe';
import { api } from '@/lib/api';
import { fmt, fmtRate, LIMITS_CLIENT } from '@/lib/format';

export default function ExchangePage() {
  const { me, loading, reload } = useMe();
  const router = useRouter();
  const [from, setFrom] = useState('USDT');
  const [to, setTo] = useState('ETH');
  const [amount, setAmount] = useState('500');
  const [pair, setPair] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Balances come from useMe(), which only refetches every 15s or on tab
  // focus — fine for casual viewing, but if you just topped up or finished
  // a previous exchange and immediately switch to this tab, that snapshot
  // can be stale. Force a fresh read whenever this tab is opened so
  // "макс" fills in what's actually there right now.
  useEffect(() => { reload(); }, [reload]);

  if (loading || !me) return null;

  const amt = parseAmount(amount);
  const balance = me.balances[from] || 0;
  const out = pair ? amt * pair.rate : 0;
  const errMsg = pair && !pair.enabled ? 'Пара временно недоступна' : '';
  const canSubmit = amt > 0 && (!pair || pair.enabled);

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      // Exchange always settles to the platform balance — sending the
      // result straight to an external wallet is handled separately by the
      // "Вывод" tab, as a normal withdrawal from balance.
      const data = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ from, to, amount, dest: 'internal' }),
      });
      router.push(`/app/orders/${data.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="title">Обмен</div>
      </div>
      <div className="page">
        <Calculator
          initial={{ from, to, amount }}
          onValueChange={(v) => {
            setFrom(v.from);
            setTo(v.to);
            setAmount(v.amount);
            setPair(v.pair || null);
          }}
        />
        <div className="small muted" style={{ padding: '8px 4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Баланс: <b className="mono">{fmt(balance, from)} {from}</b>{' '}
            <button className="link" onClick={() => setAmount(String(balance))}>макс</button>
          </span>
          <span>Лимит: {LIMITS_CLIENT[me.kycLevel]?.label}</span>
        </div>

        {pair && (
          <div className="card">
            <div className="row small">
              <span className="muted">Курс</span>
              <b className="mono">1 {from} = {fmtRate(pair.partnerRate)} {to}</b>
            </div>
            <div className="hr" />
            <div className="row">
              <span>К получению</span>
              <b className="mono" style={{ fontSize: 18 }}>{fmtRate(out)} {to}</b>
            </div>
          </div>
        )}

        {(err || errMsg) && <div className="err" style={{ margin: '-4px 0 10px', textAlign: 'center' }}>{err || errMsg}</div>}
        <button className="btn amber" disabled={!canSubmit || busy} onClick={submit}>
          Зафиксировать курс на 15 минут
        </button>
      </div>
    </>
  );
}
