'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import HeroTerminal from '@/components/HeroTerminal';
import Toast, { toast } from '@/components/Toast';
import { Icon } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { LanguageProvider, LanguageToggle, useLang } from '@/lib/i18n';

const REVIEWS = [
  {
    name: 'Анна К.',
    color: '#26A17B',
    ru: 'Перевёл USDT в ETH за 10 минут, курс не поплыл. Удобно, что можно на баланс, а можно сразу на кошелёк.',
    en: 'Converted USDT to ETH in 10 minutes, the rate didn\u2019t move. Nice that you can choose your balance or straight to your wallet.',
    dateRu: '7 Сентября 2026', dateEn: 'September 7, 2026',
  },
  {
    name: 'Сергей Б.',
    color: '#4E5FD6',
    ru: 'Пользуюсь для регулярного обмена. Комиссия честная, без сюрпризов в конце.',
    en: 'I use it for regular exchanges. The fee is honest, no surprises at the end.',
    dateRu: '7 Сентября 2026', dateEn: 'September 7, 2026',
  },
  {
    name: 'Диана С.',
    color: '#7B3FE4',
    ru: 'Служба поддержки ответила быстро, помогли разобраться с адресом для вывода.',
    en: 'Support replied quickly and helped me sort out the withdrawal address.',
    dateRu: '7 Сентября 2026', dateEn: 'September 7, 2026',
  },
  {
    name: 'Тимур А.',
    color: '#F7931A',
    ru: 'Прошёл верификацию за один день, лимиты выросли сразу.',
    en: 'Got verified in one day, limits went up right away.',
    dateRu: '6 Сентября 2026', dateEn: 'September 7, 2026',
  },
];

function LandingInner() {
  const { lang, t } = useLang();
  const [installEvt, setInstallEvt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function install() {
    if (installEvt) {
      installEvt.prompt();
      return;
    }
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    toast(ios
      ? t({ ru: 'Safari → Поделиться → «На экран Домой»', en: 'Safari → Share → "Add to Home Screen"' })
      : t({ ru: 'Меню браузера → «Добавить на главный экран»', en: 'Browser menu → "Add to Home screen"' }));
  }

  return (
    <div className="shell wide" style={{ background: 'var(--ink)' }}>
      <div className="hero">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="logo">
            <LogoMark />OKPAYS.EXCHANGE
          </div>
          <LanguageToggle />
        </div>
        <div className="small muted" style={{ marginTop: 6, marginBottom: 4 }}>
          {t({ ru: 'Надёжный обмен, проверенный временем!', en: 'Reliability, tested by time.' })}
        </div>

        <div className="hero-grid">
          <div className="hero-copy-top">
            <h1 style={{ marginTop: 14 }}>
              {t({ ru: 'КУРС ОБМЕНА ФИКСИРУЕТСЯ НА 15 МИНУТ!', en: 'EXCHANGE RATE LOCKED FOR 15 MINUTES!' })}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <span className="reserve-badge">{t({ ru: 'РЕЗЕРВ $700,000', en: 'RESERVE $700,000' })}</span>
              <span className="tg-badge">{Icon.telegram} {t({ ru: 'ПОДДЕРЖКА В TELEGRAM', en: 'SUPPORT ON TELEGRAM' })}</span>
            </div>
          </div>
          <div className="terminal-wrap">
            <HeroTerminal />
          </div>
          <div className="hero-copy-bottom">
            <div className="hero-actions" style={{ marginTop: 14 }}>
              <Link href="/register" className="btn-solid">{t({ ru: 'Регистрация', en: 'Sign Up' })}</Link>
              <Link href="/login" className="btn-outline">{t({ ru: 'Войти', en: 'Log In' })}</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="ticker-strip">
        <TickerText />
      </div>

      <div className="hero hero-below" style={{ paddingTop: 30 }}>
        <h2 style={{ color: 'var(--paper)', fontSize: 19, margin: 0 }}>{t({ ru: 'Отзывы', en: 'Reviews' })}</h2>
        <div className="scroll-row">
          {REVIEWS.map((r) => (
            <div key={r.name} className="review-card">
              <div className="who">
                <span className="avatar" style={{ background: r.color }}>{r.name[0]}</span>
                <span className="name">{r.name}</span>
              </div>
              <div className="text">{lang === 'en' ? r.en : r.ru}</div>
              <div className="date">{lang === 'en' ? r.dateEn : r.dateRu}</div>
            </div>
          ))}
        </div>

        <div className="ledger" style={{ marginTop: 26 }}>
          <div className="cell"><div className="v">{t({ ru: '15 мин', en: '15 min' })}</div><div className="l">{t({ ru: 'фиксация курса', en: 'rate lock' })}</div></div>
          <div className="cell"><div className="v">0.5%</div><div className="l">{t({ ru: 'комиссия, без скрытых платежей', en: 'fee, no hidden charges' })}</div></div>
          <div className="cell"><div className="v">24/7</div><div className="l">{t({ ru: 'поддержка в Telegram', en: 'support on Telegram' })}</div></div>
        </div>

        <InstallAccordion install={install} />

        <p className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '26px 0 4px' }}>
          © OKPAYS.EXCHANGE 2026 · {t({ ru: 'Обмен криптовалют', en: 'Crypto Exchange' })}
        </p>
      </div>
      <Toast />
    </div>
  );
}

export default function Landing() {
  return (
    <LanguageProvider>
      <LandingInner />
    </LanguageProvider>
  );
}

const COINS_FOR_TICKER = ['ETH', 'BTC', 'SOL', 'TON', 'TRX', 'USDC'];
function TickerText() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch('/api/pairs');
        const data = await res.json();
        const map: Record<string, number> = {};
        for (const p of data.pairs || []) {
          if (p.to === 'USDT' && COINS_FOR_TICKER.includes(p.from)) map[p.from] = p.partnerRate;
        }
        if (!stop) setPrices(map);
      } catch {}
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  const list = COINS_FOR_TICKER.filter((c) => prices[c]);
  const row = (
    <span className="row">
      {list.map((c) => (
        <span key={c} className="cell">
          <b>{c}/USDT</b>
          <span className="up">{prices[c].toLocaleString('en-US', { maximumFractionDigits: c === 'TRX' ? 4 : 2 })}</span>
        </span>
      ))}
    </span>
  );
  // Duplicated enough times that the strip stays fully covered on very wide
  // desktop monitors — with only 2 copies (fine on a phone), a wide screen
  // scrolls past the end of the second copy before the first one loops back
  // in, leaving a visible empty gap. 6 copies covers any realistic browser
  // width; the keyframe below moves by exactly 1/6 of the total each loop.
  return <div className="track">{row}{row}{row}{row}{row}{row}</div>;
}

type Platform = 'ios' | 'android' | 'desktop';

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);
const MenuDotsIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
);
const DesktopIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);

function InstallAccordion({ install }: { install: () => void }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) setPlatform('ios');
    else if (/android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');
  }, []);

  const content: Record<Platform, { Icon: () => React.JSX.Element; ru: string; en: string }> = {
    ios: {
      Icon: ShareIcon,
      ru: 'Safari → значок «Поделиться» внизу экрана → «На экран «Домой»» → «Добавить».',
      en: 'Safari → the Share icon at the bottom → "Add to Home Screen" → "Add".',
    },
    android: {
      Icon: MenuDotsIcon,
      ru: 'Chrome → три точки в углу экрана → «Установить приложение» → «Установить».',
      en: 'Chrome → the three-dot menu in the corner → "Install app" → "Install".',
    },
    desktop: {
      Icon: DesktopIcon,
      ru: 'Значок установки в адресной строке браузера (справа) → «Установить».',
      en: 'The install icon in the browser\u2019s address bar (on the right) → "Install".',
    },
  };

  const { Icon, ru, en } = content[platform];

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #1c2a22' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'none', border: 0, cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        <div>
          <div style={{ color: 'var(--paper)', fontWeight: 700, fontSize: 14.5 }}>{t({ ru: 'Установить как приложение', en: 'Install as an app' })}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{t({ ru: 'Иконка на экране, работает как нативное.', en: 'Icon on your home screen, works like a native app.' })}</div>
        </div>
        <span style={{ color: 'var(--paper)', fontSize: 18, flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, background: 'var(--ink-2)', border: '1px solid #223028', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: '#0e1512', border: '1px solid #26352c', color: 'var(--amber)', display: 'grid', placeItems: 'center' }}>
            <Icon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small" style={{ color: '#c3cfc9', lineHeight: 1.45, marginBottom: 10 }}>{lang === 'en' ? en : ru}</div>
            <button onClick={install} className="btn sm amber" style={{ width: 'auto' }}>
              {t({ ru: 'Установить сейчас', en: 'Install now' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
