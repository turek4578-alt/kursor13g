'use client';
import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '../../useMe';
import { api } from '@/lib/api';
import { fmt, usd } from '@/lib/format';
import { toast } from '@/components/Toast';

export default function WithdrawCoinPage({ params }: { params: Promise<{ coin: string }> }) {
  const { coin } = usePromise(params);
  const router = useRouter();
  const { me, reload } = useMe();
  const [balance, setBalance] = useState<number | null>(null);
  const [price, setPrice] = useState(0);
  const [addr, setAddr] = useState('');
  const [amt, setAmt] = useState('');
  const [twofaCode, setTwofaCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function load() {
    const d = await api('/api/wallets');
    const w = d.wallets.find((x: any) => x.coin === coin);
    setBalance(w ? w.balance : 0);
    const p = await api('/api/pairs');
    const pr = p.pairs.find((x: any) => x.from === coin && x.to === 'USDT');
    setPrice(coin === 'USDT' || coin === 'USDC' ? 1 : pr?.partnerRate || 0);
  }
  useEffect(() => { load(); }, [coin]);

  if (balance === null || !me) {
    return <><div className="topbar"><button className="back" onClick={() => router.back()}>‹</button><div className="title">Вывод {coin}</div></div><div className="page" /></>;
  }

  if (balance <= 0) {
    return (
      <>
        <div className="topbar"><button className="back" onClick={() => router.push('/app/withdraw')}>‹</button><div className="title">Вывод {coin}</div></div>
        <div className="page">
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontWeight: 700 }}>На балансе нет {coin}</div>
            <div className="small muted" style={{ marginTop: 6 }}>Сначала пополните баланс этой монетой или обменяйте на неё.</div>
          </div>
        </div>
      </>
    );
  }

  async function submitWithdraw() {
    setErr('');
    setBusy(true);
    try {
      await api('/api/wallets', { method: 'POST', body: JSON.stringify({ action: 'withdraw', coin, amount: amt, address: addr, code: twofaCode }) });
      setShowConfirm(false);
      toast('Заявка на вывод отправлена');
      reload();
      router.push('/app/withdraw');
    } catch (e: any) {
      setErr(e.message);
      setShowConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = addr.trim().length >= 12 && !!amt && twofaCode.length >= 6;

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/withdraw')}>‹</button>
        <div className="title">Вывод {coin}</div>
      </div>
      <div className="page">
        <div className="card dark" style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: '#7c8b84' }}>Доступно к выводу</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{fmt(balance, coin)} {coin}</div>
          <div className="small" style={{ color: '#7c8b84' }}>{usd(balance * price)}</div>
        </div>

        <div className="card">
          <label className="f">
            <span>Адрес получателя</span>
            <input className="in mono" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Например, адрес Trust Wallet" />
          </label>
          <label className="f">
            <span>Сумма</span>
            <div className="row" style={{ gap: 8 }}>
              <input className="in mono" style={{ flex: 1 }} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" />
              <button className="btn sm ghost" style={{ width: 'auto' }} onClick={() => setAmt(String(balance))}>Макс</button>
            </div>
          </label>
          {me.twofaEnabled ? (
            <label className="f">
              <span>Код из приложения-аутентификатора</span>
              <input className="in mono" inputMode="numeric" maxLength={6} value={twofaCode} onChange={(e) => setTwofaCode(e.target.value)} placeholder="000000" />
            </label>
          ) : (
            <div className="hint" style={{ marginBottom: 12 }}>Включите 2FA в профиле, чтобы выводить средства.</div>
          )}
          {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
          <button className="btn" disabled={busy || !canSubmit} onClick={() => setShowConfirm(true)}>Вывести {coin}</button>
        </div>
      </div>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" style={{ maxWidth: 340, margin: 0 }}>
            <h3 style={{ marginBottom: 10 }}>Подтверждение вывода</h3>
            <p className="small muted" style={{ marginBottom: 6 }}>
              {fmt(parseFloat(amt.replace(',', '.')) || 0, coin)} {coin} на адрес:
            </p>
            <div className="addr" style={{ marginBottom: 12 }}>{addr}</div>
            <p className="small" style={{ marginBottom: 16 }}>
              Вывод средств в ручном режиме занимает 10–15 минут.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => setShowConfirm(false)} disabled={busy}>Отмена</button>
              <button className="btn sm" style={{ flex: 1 }} onClick={submitWithdraw} disabled={busy}>ПОДТВЕРДИТЬ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
