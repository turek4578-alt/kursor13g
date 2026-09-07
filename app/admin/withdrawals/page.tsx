'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt, dt, STATUS_RU_CLIENT } from '@/lib/format';

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState('pending');

  async function load() {
    const d = await api('/api/admin/withdrawals');
    setRows(d.withdrawals);
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const filtered = rows.filter((w) => (tab === 'all' ? true : w.status === tab));

  async function complete(id: string) {
    const note = prompt('Комментарий (необязательно, например хеш транзакции):') || '';
    try {
      await api('/api/admin/withdrawals', { method: 'POST', body: JSON.stringify({ id, action: 'complete', note }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function reject(id: string) {
    const note = prompt('Причина отказа (обязательно — сумма вернётся на баланс пользователя):');
    if (!note) return;
    try {
      await api('/api/admin/withdrawals', { method: 'POST', body: JSON.stringify({ id, action: 'reject', note }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Заявки на вывод</h1>
      <div className="small muted" style={{ marginBottom: 16 }}>{rows.length} всего</div>
      <div className="tabs">
        {[['pending', 'Ожидают'], ['completed', 'Выполнены'], ['rejected', 'Отклонены'], ['all', 'Все']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Время</th><th>Пользователь</th><th>Монета</th><th>Сумма</th><th>Адрес</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 30 }}>Пусто</td></tr>}
            {filtered.map((w) => (
              <tr key={w.id}>
                <td className="mono small">{dt(w.created_at)}</td>
                <td>{w.user_name}<div className="small muted">{w.user_email}</div></td>
                <td className="mono">{w.coin}</td>
                <td className="mono">{fmt(w.amount, w.coin)}</td>
                <td className="mono small">{w.address}</td>
                <td><span className={`st st-${w.status === 'completed' ? 'approved' : w.status === 'rejected' ? 'rejected' : 'pending'}`}>{w.status === 'pending' ? 'Ожидает' : w.status === 'completed' ? 'Выполнена' : 'Отклонена'}</span></td>
                <td>
                  {w.status === 'pending' ? (
                    <div className="acts">
                      <button className="btn xs green" onClick={() => complete(w.id)}>Отправлено</button>
                      <button className="btn xs danger" onClick={() => reject(w.id)}>Отклонить</button>
                    </div>
                  ) : (
                    <span className="small muted">{w.admin_note}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
