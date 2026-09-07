'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt, dt, usd, STATUS_RU_CLIENT } from '@/lib/format';
import { toast } from '@/components/Toast';

const COIN_LIST: { coin: string; network: string; placeholder: string; checkable: boolean }[] = [
  { coin: 'USDT', network: 'TRC20', placeholder: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: true },
  { coin: 'USDC', network: 'ERC20', placeholder: '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
  { coin: 'ETH', network: 'ERC20', placeholder: '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
  { coin: 'BTC', network: 'Bitcoin', placeholder: 'bc1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
  { coin: 'SOL', network: 'Solana', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
  { coin: 'TON', network: 'TON', placeholder: 'EQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
  { coin: 'TRX', network: 'TRC20', placeholder: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', checkable: false },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: any; orders: any[]; overrides: { coin: string; address: string }[] } | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function load() {
    const d = await api('/api/admin/users');
    setUsers(d.users);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    api(`/api/admin/users?id=${selected}`).then((d) => {
      setDetail(d);
      const next: Record<string, string> = {};
      for (const c of COIN_LIST) next[c.coin] = d.overrides?.find((o: any) => o.coin === c.coin)?.address || '';
      setInputs(next);
      setErrs({});
    });
  }, [selected]);

  async function saveOverride(coin: string) {
    if (!selected) return;
    setBusy((b) => ({ ...b, [coin]: true }));
    setErrs((e) => ({ ...e, [coin]: '' }));
    try {
      await api('/api/admin/wallet-override', { method: 'POST', body: JSON.stringify({ userId: selected, coin, address: inputs[coin] }) });
      const d = await api(`/api/admin/users?id=${selected}`);
      setDetail(d);
    } catch (e: any) {
      setErrs((er) => ({ ...er, [coin]: e.message }));
    } finally {
      setBusy((b) => ({ ...b, [coin]: false }));
    }
  }

  const [adjCoin, setAdjCoin] = useState('USDT');
  const [adjAmt, setAdjAmt] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjErr, setAdjErr] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgErr, setMsgErr] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);

  async function sendMessage() {
    if (!selected) return;
    setMsgBusy(true);
    setMsgErr('');
    try {
      await api('/api/admin/message', { method: 'POST', body: JSON.stringify({ userId: selected, message: msgText }) });
      setMsgText('');
      toast('Сообщение отправлено');
    } catch (e: any) {
      setMsgErr(e.message);
    } finally {
      setMsgBusy(false);
    }
  }

  async function adjustBalance() {
    if (!selected) return;
    setAdjBusy(true);
    setAdjErr('');
    try {
      await api('/api/admin/adjust-balance', { method: 'POST', body: JSON.stringify({ userId: selected, coin: adjCoin, amount: adjAmt, reason: adjReason }) });
      setAdjAmt(''); setAdjReason('');
      const d = await api(`/api/admin/users?id=${selected}`);
      setDetail(d);
    } catch (e: any) {
      setAdjErr(e.message);
    } finally {
      setAdjBusy(false);
    }
  }

  async function toggleBlock(u: any) {
    const reason = prompt('Причина:');
    if (!reason) return;
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: u.id, action: u.status === 'blocked' ? 'unblock' : 'block', reason }) });
    load();
    if (selected === u.id) api(`/api/admin/users?id=${selected}`).then(setDetail);
  }

  if (selected && detail) {
    const u = detail.user;
    const orders = detail.orders;
    const turnover = orders.filter((o: any) => o.status === 'completed').reduce((s: number, o: any) => s + o.amount_from, 0);
    return (
      <>
        <h1 style={{ fontSize: 22 }}>{u.name}</h1>
        <div className="small muted" style={{ marginBottom: 12 }}>{u.email}</div>
        <button className="btn sm ghost" style={{ marginBottom: 12 }} onClick={() => setSelected(null)}>← К списку</button>
        <div className="kpis">
          <div className="kpi"><div className="v">L{u.kyc_level}</div><div className="l">KYC <span className={`st st-${u.kyc_status}`}>{STATUS_RU_CLIENT[u.kyc_status]}</span></div></div>
          <div className="kpi"><div className="v">{orders.length}</div><div className="l">заявок</div></div>
          <div className="kpi"><div className="v">{turnover.toFixed(2)}</div><div className="l">оборот (в валюте заявки)</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Профиль</h3>
            <div className="small">
              Регистрация: {dt(u.created_at)}<br />
              Статус: <span className={`st st-${u.status}`}>{STATUS_RU_CLIENT[u.status]}</span><br />
              2FA: {u.twofa_enabled ? 'да' : 'нет'}<br />
              Реферал: <span className="mono">{u.referral_code}</span>
            </div>
            <div className="acts" style={{ marginTop: 12 }}>
              <button className={`btn xs ${u.status === 'blocked' ? 'green' : 'danger'}`} onClick={() => toggleBlock(u)}>
                {u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
              </button>
              {u.kyc_status === 'pending' && (
                <>
                  <button className="btn xs green" onClick={async () => { await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: u.id, action: 'kyc_approve' }) }); api(`/api/admin/users?id=${selected}`).then(setDetail); load(); }}>Подтвердить KYC</button>
                  <button className="btn xs danger" onClick={async () => { const r = prompt('Причина отказа:'); if (!r) return; await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: u.id, action: 'kyc_reject', reason: r }) }); api(`/api/admin/users?id=${selected}`).then(setDetail); load(); }}>Отклонить KYC</button>
                </>
              )}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Балансы</h3>
            {Object.entries(u.balances).filter(([, v]: any) => v > 0).map(([c, v]: any) => (
              <div key={c} className="row small"><span>{c}</span><span className="mono">{fmt(v, c)}</span></div>
            ))}
            {Object.values(u.balances).every((v: any) => v === 0) && <div className="small muted">Пусто</div>}
            <div className="hr" />
            <div className="small muted" style={{ marginBottom: 8 }}>Ручная корректировка (например, депозит в монете без автопроверки)</div>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <select className="in" style={{ flex: 1 }} value={adjCoin} onChange={(e) => setAdjCoin(e.target.value)}>
                {Object.keys(u.balances).map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="in mono" style={{ flex: 1 }} placeholder="+10 или -5" value={adjAmt} onChange={(e) => setAdjAmt(e.target.value)} />
            </div>
            <input className="in" style={{ marginBottom: 6 }} placeholder="Причина корректировки" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
            {adjErr && <div className="err" style={{ marginBottom: 6 }}>{adjErr}</div>}
            <button className="btn xs" disabled={adjBusy || !adjAmt || !adjReason} onClick={adjustBalance}>Применить</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Написать пользователю</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>Сообщение появится у него баннером в кабинете.</div>
          <textarea className="in" rows={3} style={{ marginBottom: 8 }} placeholder="Например: уточните, пожалуйста, адрес для вывода" value={msgText} onChange={(e) => setMsgText(e.target.value)} />
          {msgErr && <div className="err" style={{ marginBottom: 6 }}>{msgErr}</div>}
          <button className="btn xs" disabled={msgBusy || !msgText.trim()} onClick={sendMessage}>Отправить</button>
        </div>

        {u.kyc_status === 'pending' && (u.kyc_photo_document || u.kyc_photo_selfie) && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Фото на проверку</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="small muted" style={{ marginBottom: 6 }}>Документ</div>
                {u.kyc_photo_document ? (
                  <img src={u.kyc_photo_document} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
                ) : (
                  <div className="small muted">Не загружено</div>
                )}
              </div>
              <div>
                <div className="small muted" style={{ marginBottom: 6 }}>Селфи</div>
                {u.kyc_photo_selfie ? (
                  <img src={u.kyc_photo_selfie} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
                ) : (
                  <div className="small muted">Не загружено</div>
                )}
              </div>
            </div>
            <div className="acts">
              <button className="btn sm green" onClick={async () => { await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: u.id, action: 'kyc_approve' }) }); api(`/api/admin/users?id=${selected}`).then(setDetail); load(); }}>Подтвердить KYC</button>
              <button className="btn sm danger" onClick={async () => { const r = prompt('Причина отказа:'); if (!r) return; await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: u.id, action: 'kyc_reject', reason: r }) }); api(`/api/admin/users?id=${selected}`).then(setDetail); load(); }}>Отклонить KYC</button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Адреса приёма по монетам</h3>
          <div className="small muted" style={{ marginBottom: 14 }}>
            Если для монеты указан адрес — именно его видит пользователь в своём кошельке. Платформа не хранит
            приватный ключ ни от одного из этих адресов — ключ должен быть у вас или у пользователя. Пустое поле +
            сохранение возвращает обычный отображаемый (не настоящий) адрес.
            <br />
            Автоматическая проверка блокчейна пока реализована только для <b>USDT (TRC20)</b>. Для остальных монет
            адрес просто отображается пользователю — зачисление после реального перевода делается вручную, через
            изменение баланса на этой странице.
          </div>
          {COIN_LIST.map(({ coin, network, placeholder, checkable }) => {
            const active = detail?.overrides?.find((o) => o.coin === coin);
            return (
              <div key={coin} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                <div className="row small" style={{ marginBottom: 6 }}>
                  <span><b>{coin}</b> <span className="muted">· {network}</span></span>
                  {checkable ? (
                    <span className="st st-approved">проверка блокчейна работает</span>
                  ) : (
                    <span className="st st-pending">только адрес, без автопроверки</span>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="in mono"
                    style={{ flex: 1 }}
                    placeholder={placeholder}
                    value={inputs[coin] || ''}
                    onChange={(e) => setInputs((i) => ({ ...i, [coin]: e.target.value }))}
                  />
                  <button className="btn sm" style={{ width: 'auto' }} disabled={busy[coin]} onClick={() => saveOverride(coin)}>
                    Сохранить
                  </button>
                </div>
                {errs[coin] && <div className="err" style={{ marginTop: 8 }}>{errs[coin]}</div>}
                {active && (
                  <div className="small" style={{ marginTop: 8, color: 'var(--green)' }}>
                    Сейчас активен адрес: <span className="mono">{active.address}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Заявки</h3>
          {orders.map((o: any) => (
            <div key={o.id} className="row small" style={{ marginBottom: 6 }}>
              <span className="mono">{o.public_id}</span>
              <span>{o.from_currency}→{o.to_currency} {fmt(o.amount_from, o.from_currency)}</span>
              <span className="mono muted">{dt(o.created_at)}</span>
              <span className={`st st-${o.status}`}>{STATUS_RU_CLIENT[o.status]}</span>
            </div>
          ))}
          {orders.length === 0 && <span className="small muted">Нет</span>}
        </div>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Пользователи</h1>
      <div className="small muted" style={{ marginBottom: 16 }}>{users.length} всего</div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Пользователь</th><th>Регистрация</th><th>KYC</th><th>Уровень</th><th>Заявок</th><th>Статус</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="tap" onClick={() => setSelected(u.id)}>
                <td><b>{u.name}</b><div className="small muted">{u.email}</div></td>
                <td className="mono small">{dt(u.created_at)}</td>
                <td><span className={`st st-${u.kyc_status}`}>{STATUS_RU_CLIENT[u.kyc_status]}</span></td>
                <td className="mono">L{u.kyc_level}</td>
                <td className="mono">{u.orderCount}</td>
                <td><span className={`st st-${u.status}`}>{STATUS_RU_CLIENT[u.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
