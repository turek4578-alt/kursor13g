'use client';
import { useEffect, useState } from 'react';

let listeners: ((msg: string) => void)[] = [];
export function toast(msg: string) {
  listeners.forEach((l) => l(msg));
}

export default function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const fn = (m: string) => {
      setMsg(m);
      const t = setTimeout(() => setMsg(null), 1800);
      return () => clearTimeout(t);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
