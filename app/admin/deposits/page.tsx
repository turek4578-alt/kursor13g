'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt, dt } from '@/lib/format';

export default function AdminDepositsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState('pending');

  async function load() {
    const d = await api('/api/admin/deposits');
    setRows(d.requests);
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const filtered = rows.filter((r) => (tab === 'all' ? true : r.status === tab));

  async function confirm(id: string) {
    if (!window.confirm('Вы лично сверили этот перевод в блокчейн-эксплорере? Подтверждение сразу зачислит сумму на баланс пользователя.')) return;
    const note = prompt('Комментарий (необязательно, например хеш транзакции):') || '';
    try {
      await api('/api/admin/deposits', { method: 'POST', body: JSON.stringify({ id, action: 'confirm', note }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function reject(id: string) {
    const note = prompt('Причина отказа:');
    if (!note) return;
    try {
      await api('/api/admin/deposits', { method: 'POST', body: JSON.stringify({ id, action: 'reject', note }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Заявки на пополнение кошелька</h1>
      <div className="small muted" style={{ marginBottom: 16 }}>
        {rows.length} всего · монеты без автопроверки блокчейна — сверяйте адрес и сумму сами перед подтверждением
      </div>
      <div className="tabs">
        {[['pending', 'Ожидают'], ['confirmed', 'Подтверждены'], ['rejected', 'Отклонены'], ['all', 'Все']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Время</th><th>Пользователь</th><th>Монета</th><th>Заявлено</th><th>Адрес</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 30 }}>Пусто</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="mono small">{dt(r.created_at)}</td>
                <td>{r.user_email}</td>
                <td className="mono">{r.coin}</td>
                <td className="mono">{fmt(r.amount, r.coin)}</td>
                <td className="mono small">{r.address}</td>
                <td><span className={`st st-${r.status === 'confirmed' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>{r.status === 'pending' ? 'Ожидает' : r.status === 'confirmed' ? 'Подтверждена' : 'Отклонена'}</span></td>
                <td>
                  {r.status === 'pending' ? (
                    <div className="acts">
                      <button className="btn xs green" onClick={() => confirm(r.id)}>Подтвердить</button>
                      <button className="btn xs danger" onClick={() => reject(r.id)}>Отклонить</button>
                    </div>
                  ) : (
                    <span className="small muted">{r.admin_note}</span>
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
