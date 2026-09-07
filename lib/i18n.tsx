'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'ru' | 'en';
const STORAGE_KEY = 'kurs_lang';

type Dict = Record<string, string>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (dict: { ru: string; en: string }) => string };

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Lang | null) : null;
    if (saved === 'ru' || saved === 'en') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }

  function t(dict: { ru: string; en: string }) {
    return lang === 'en' ? dict.en : dict.ru;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div style={{ display: 'inline-flex', background: '#0e1512', border: '1px solid #26352c', borderRadius: 999, padding: 3 }}>
      {(['ru', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: '5px 12px', borderRadius: 999, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: lang === l ? 'var(--amber)' : 'transparent',
            color: lang === l ? 'var(--ink)' : '#8b998f',
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
