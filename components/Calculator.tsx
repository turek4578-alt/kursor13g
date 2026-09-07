'use client';
import { parseAmount } from '@/lib/parseAmount';
import { useEffect, useState, useCallback } from 'react';
import { CoinChip } from './icons';

const COIN_LIST = ['USDT', 'USDC', 'ETH', 'BTC', 'SOL', 'TON', 'TRX'];

type Pair = { from: string; to: string; enabled: boolean; spreadBps: number; minUsd: number; maxUsd: number; rate: number; partnerRate: number };

function fmtRate(n: number) {
  if (!n) return '0';
  const d = n >= 100 ? 2 : n >= 1 ? 4 : Math.min(10, Math.ceil(-Math.log10(n)) + 4);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: d });
}

export default function Calculator({
  onValueChange,
  initial,
}: {
  onValueChange?: (v: { from: string; to: string; amount: string; pair?: Pair }) => void;
  initial?: { from: string; to: string; amount: string };
}) {
  const [from, setFrom] = useState(initial?.from || 'USDT');
  const [to, setTo] = useState(initial?.to || 'ETH');
  const [amount, setAmount] = useState(initial?.amount ?? '500');
  const [pairs, setPairs] = useState<Pair[]>([]);

  // useState's initial value is only read once, at mount — so a parent
  // calling something like setAmount(balance) to fill in a "max" button
  // changes its own `initial` prop, but this component would otherwise
  // never notice and the input would silently keep showing whatever the
  // user last typed. Re-sync whenever the parent's amount actually
  // changes (not on every render — `initial` is a fresh object literal
  // each time, so this depends on the primitive value, not the object).
  useEffect(() => {
    if (initial?.amount !== undefined) setAmount(initial.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.amount]);

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

  useEffect(() => {
    onValueChange?.({ from, to, amount, pair });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, amount, pair?.rate]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  return (
    <div className="xw">
      <div className="side">
        <div className="lab">
          <span>Отдаёте</span>
          <span>{from === 'BTC' ? 'Bitcoin' : from === 'SOL' ? 'Solana' : from === 'TON' ? 'TON' : from.endsWith('T') && from !== 'USDT' ? 'ERC20' : from === 'USDT' || from === 'TRX' ? 'TRC20' : 'ERC20'}</span>
        </div>
        <div className="amt">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <select
            className="coin"
            value={from}
            onChange={(e) => {
              const v = e.target.value;
              setFrom(v);
              if (to === v) setTo(v === 'USDT' ? 'ETH' : 'USDT');
            }}
            style={{ border: 'none', background: 'transparent', fontWeight: 700 }}
          >
            {COIN_LIST.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="swap">
        <button aria-label="Поменять местами" onClick={swap}>
          ⇅
        </button>
      </div>
      <div className="side">
        <div className="lab">
          <span>Получаете</span>
          <span>&nbsp;</span>
        </div>
        <div className="amt">
          <input readOnly value={fmtRate(out)} />
          <select
            className="coin"
            value={to}
            onChange={(e) => {
              const v = e.target.value;
              setTo(v);
              if (from === v) setFrom(v === 'USDT' ? 'ETH' : 'USDT');
            }}
            style={{ border: 'none', background: 'transparent', fontWeight: 700 }}
          >
            {COIN_LIST.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="rateline">
        <span>
          1 {from} = <b>{pair ? fmtRate(pair.rate) : '…'} {to}</b>
        </span>
        <span>комиссия {pair ? (pair.spreadBps / 100).toFixed(1) : '—'}%</span>
      </div>
    </div>
  );
}
