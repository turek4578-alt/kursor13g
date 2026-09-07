'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRate } from '@/lib/format';

export default function AdminPairsPage() {
  const [pairs, setPairs] = useState<any[]>([]);
  const [kill, setKill] = useState(false);

  async function load() {
    const d = await api('/api/admin/pairs');
    setPairs(d.pairs.filter((p: any) => p.from_currency === 'USDT' || p.to_currency === 'USDT'));
    const k = await api('/api/admin/kill');
    setKill(k.killSwitch);
  }
  useEffect(() => { load(); }, []);

  async function setSpread(id: string, spreadBps: number) {
    await api('/api/admin/pairs', { method: 'POST', body: JSON.stringify({ id, spreadBps }) });
    load();
  }
  async function setMinUsd(id: string, minUsd: number) {
    await api('/api/admin/pairs', { method: 'POST', body: JSON.stringify({ id, minUsd }) });
    load();
  }
  async function toggleEnabled(id: string, enabled: boolean) {
    await api('/api/admin/pairs', { method: 'POST', body: JSON.stringify({ id, enabled: !enabled }) });
    load();
  }
  async function toggleKill() {
    const d = await api('/api/admin/kill', { method: 'POST' });
    setKill(d.killSwitch);
  }

  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Пары и спреды</h1>
      <div className="small muted" style={{ marginBottom: 16 }}>Изменения применяются мгновенно к калькулятору</div>
      <div className={`banner ${kill ? 'red' : 'blue'}`}>
        <span>Kill switch: {kill ? 'ВСЕ ПАРЫ НА ПАУЗЕ, выплаты остановлены' : 'выключен'}</span>
        <button className={`btn xs ${kill ? 'green' : 'danger'}`} onClick={toggleKill}>
          {kill ? 'Возобновить работу' : 'Остановить всё'}
        </button>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Пара</th><th>Курс партнёра</th><th>Спред %</th><th>Наш курс</th><th>Мин, $</th><th>Вкл</th></tr></thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.id}>
                <td className="mono"><b>{p.from_currency}→{p.to_currency}</b></td>
                <td className="mono small">{fmtRate(p.partnerRate)}</td>
                <td>
                  <input
                    className="in mono"
                    style={{ width: 80, padding: '6px 8px' }}
                    defaultValue={(p.spread_bps / 100).toFixed(2)}
                    onBlur={(e) => setSpread(p.id, Math.round(parseFloat(e.target.value || '0') * 100))}
                  />
                </td>
                <td className="mono small">{fmtRate(p.ourRate)}</td>
                <td>
                  <input
                    className="in mono"
                    style={{ width: 70, padding: '6px 8px' }}
                    defaultValue={p.min_usd}
                    onBlur={(e) => setMinUsd(p.id, parseFloat(e.target.value || '0'))}
                  />
                </td>
                <td><button className={`toggle ${p.enabled ? 'on' : ''}`} onClick={() => toggleEnabled(p.id, !!p.enabled)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
