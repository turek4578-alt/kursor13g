'use client';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, usd } from '@/lib/format';
import { toast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';

export default function WalletPage({ params }: { params: Promise<{ coin: string }> }) {
  const { coin } = usePromise(params);
  const router = useRouter();
  const [wallet, setWallet] = useState<{ coin: string; network: string; address: string; balance: number; real?: boolean } | null>(null);
  const [price, setPrice] = useState(0);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);

  async function load() {
    const d = await api('/api/wallets');
    setWallet(d.wallets.find((w: any) => w.coin === coin) || null);
    const p = await api('/api/pairs');
    const pr = p.pairs.find((x: any) => x.from === coin && x.to === 'USDT');
    setPrice(coin === 'USDT' || coin === 'USDC' ? 1 : pr?.partnerRate || 0);
  }
  useEffect(() => { load(); }, [coin]);

  if (!wallet) return <><div className="topbar"><button className="back" onClick={() => router.back()}>‹</button><div className="title">{coin}</div></div><div className="page" /></>;

  async function deposit() {
    const amt = window.prompt(`Сколько ${coin} вы перевели? Заявка уйдёт администратору на проверку — зачисление после подтверждения, не мгновенно.`);
    if (amt === null) return;
    try {
      await api('/api/wallets', { method: 'POST', body: JSON.stringify({ action: 'deposit', coin, amount: amt }) });
      // A plain alert() instead of the auto-dismissing toast() — this one
      // needs the user to actually read it and press OK themselves, since
      // it's telling them the balance will NOT show up immediately.
      window.alert('Заявка отправлена администратору на проверку. Баланс обновится после подтверждения — не мгновенно.');
      load();
    } catch (e: any) {
      window.alert(e.message);
    }
  }

  async function checkRealDeposit() {
    setChecking(true);
    setErr('');
    try {
      const d = await api('/api/wallets/check-deposit', { method: 'POST', body: JSON.stringify({ coin }) });
      if (d.creditedCount > 0) {
        toast(`+${d.creditedTotal} ${coin} зачислено (найдено переводов: ${d.creditedCount})`);
      } else {
        toast('Новых поступлений в блокчейне не найдено');
      }
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/wallets')}>‹</button>
        <div className="title">{coin} · {wallet.network}</div>
      </div>
      <div className="page">
        <div className="card dark" style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: '#7c8b84' }}>Баланс</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{fmt(wallet.balance, coin)} {coin}</div>
          <div className="small" style={{ color: '#7c8b84' }}>{usd(wallet.balance * price)}</div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Пополнить</h3>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 14px' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}>
              <QRCodeSVG value={wallet.address} size={168} />
            </div>
          </div>
          <div className="addr" style={{ textAlign: 'center' }}>{wallet.address}</div>
          <div className="hint">Отправляйте только <b>{coin}</b> в сети <b>{wallet.network}</b>. Другие монеты будут потеряны.</div>
          {wallet.real && (
            <div className="small" style={{ color: 'var(--green)', marginTop: 6 }}>
              Это настоящий адрес — зачисление проверяется напрямую в блокчейне.
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm ghost" onClick={async () => toast((await copyText(wallet.address)) ? 'Адрес скопирован' : 'Не удалось скопировать — выделите адрес вручную')}>Скопировать</button>
            {wallet.real ? (
              <button className="btn sm blue" disabled={checking} onClick={checkRealDeposit}>
                {checking ? 'Проверяем блокчейн…' : 'Проверить в блокчейне'}
              </button>
            ) : (
              <button className="btn sm blue" onClick={deposit}>Я перевёл</button>
            )}
          </div>
        </div>

        {wallet.balance > 0 && (
          <Link href={`/app/withdraw/${coin}`} className="btn ghost" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
            Вывести {coin} на внешний кошелёк
          </Link>
        )}
      </div>
    </>
  );
}
