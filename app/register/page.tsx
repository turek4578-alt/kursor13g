'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setStoredToken } from '@/lib/session';
import { LanguageProvider, LanguageToggle, useLang } from '@/lib/i18n';

function RegisterInner() {
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [refCode, setRefCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      // Email verification is disabled for now (no email provider wired up
      // yet) — registration logs the user straight into the cabinet.
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, fullName, password, referralCode: refCode || undefined }),
      });
      if (data.token) setStoredToken(data.token);
      router.push('/app');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <Link className="back" href="/">‹</Link>
        <div className="title">{t({ ru: 'Регистрация', en: 'Sign Up' })}</div>
        <LanguageToggle />
      </div>
      <div className="page" style={{ paddingBottom: 30 }}>
        <div className="card" style={{ marginTop: 8 }}>
          <form onSubmit={submit}>
            <label className="f">
              <span>Email</span>
              <input className="in" type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label className="f">
              <span>{t({ ru: 'Имя и фамилия (латиницей)', en: 'First and last name (Latin letters)' })}</span>
              <input
                className="in"
                type="text"
                placeholder="Ivan Petrov"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                pattern="[A-Za-z\s\-']+"
                title={t({ ru: 'Только латинские буквы', en: 'Latin letters only' })}
                autoComplete="name"
                required
              />
            </label>
            <label className="f">
              <span>{t({ ru: 'Пароль', en: 'Password' })}</span>
              <input className="in" type="password" placeholder={t({ ru: 'Минимум 8 символов', en: 'At least 8 characters' })} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className="f">
              <span>{t({ ru: 'Реферальный код (необязательно)', en: 'Referral code (optional)' })}</span>
              <input className="in mono" placeholder="KURS-XXXXXX" value={refCode} onChange={(e) => setRefCode(e.target.value)} />
            </label>
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy}>{t({ ru: 'Продолжить', en: 'Continue' })}</button>
            <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
              {t({
                ru: 'Нажимая «Продолжить», вы соглашаетесь с Условиями и Политикой AML/KYC.',
                en: 'By clicking Continue, you agree to the Terms and the AML/KYC Policy.',
              })}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <LanguageProvider>
      <RegisterInner />
    </LanguageProvider>
  );
}
