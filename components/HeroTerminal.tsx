'use client';
import { parseAmount } from '@/lib/parseAmount';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';

const COIN_LIST = ['USDT', 'USDC', 'ETH', 'BTC', 'SOL', 'TON', 'TRX'];

type Pair = { from: string; to: string; enabled: boolean; spreadBps: number; rate: number; partnerRate: number };

function fmtRate(n: number) {
  if (!n) return '0';
  const d = n >= 100 ? 2 : n >= 1 ? 4 : Math.min(10, Math.ceil(-Math.log10(n)) + 4);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: d });
}

export default function HeroTerminal() {
  const { t } = useLang();
  const [from, setFrom] = useState('USDT');
  const [to, setTo] = useState('ETH');
  const [amount, setAmount] = useState('500');
  const [pairs, setPairs] = useState<Pair[]>([]);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch('/api/pairs');
        const data = await res.json();
        if (!stop) setPairs(data.pairs || []);
      } catch {}
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const pair = pairs.find((p) => p.from === from && p.to === to);
  const amt = parseAmount(amount);
  const out = pair ? amt * pair.rate : 0;

  return (
    <div className="terminal">
      <div className="row2">
        <div className="lab"><span>{t({ ru: 'Отдаёте', en: 'You send' })}</span><span>{from === 'USDT' || from === 'TRX' ? 'TRC20' : 'ERC20'}</span></div>
        <div className="amtline">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <select
            className="coinsel"
            value={from}
            onChange={(e) => {
              const v = e.target.value;
              setFrom(v);
              if (to === v) setTo(v === 'USDT' ? 'ETH' : 'USDT');
            }}
          >
            {COIN_LIST.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="swaprow">
        <button aria-label="Поменять местами" onClick={() => { setFrom(to); setTo(from); }}>⇅</button>
      </div>
      <div className="row2">
        <div className="lab"><span>{t({ ru: 'Получаете', en: 'You get' })}</span><span>&nbsp;</span></div>
        <div className="amtline out">
          <input readOnly value={fmtRate(out)} />
          <select
            className="coinsel"
            value={to}
            onChange={(e) => {
              const v = e.target.value;
              setTo(v);
              if (from === v) setFrom(v === 'USDT' ? 'ETH' : 'USDT');
            }}
          >
            {COIN_LIST.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="rate">
        <span>1 {from} = <b>{pair ? fmtRate(pair.rate) : '…'} {to}</b></span>
        <span>{t({ ru: 'комиссия', en: 'fee' })} {pair ? (pair.spreadBps / 100).toFixed(1) : '—'}%</span>
      </div>
    </div>
  );
}
