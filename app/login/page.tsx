'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setStoredToken } from '@/lib/session';
import { LanguageProvider, LanguageToggle, useLang } from '@/lib/i18n';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isStaff = params.get('staff') === '1';
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (data.token) setStoredToken(data.token);
      // Route by the account's real role, not by which URL was used to get
      // here — an admin/staff account should always land in the panel,
      // even via the plain /login page (no need to remember ?staff=1).
      const isStaffAccount = ['support', 'compliance', 'admin', 'superadmin'].includes(data.role);
      if (isStaff && !isStaffAccount) {
        setErr('У этого аккаунта нет доступа к панели управления');
        setBusy(false);
        return;
      }
      router.push(isStaffAccount ? '/admin' : '/app');
    } catch (e: any) {
      setErr(t({ ru: e.message, en: e.message }));
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <Link className="back" href="/">‹</Link>
        <div className="title">{isStaff ? 'Вход для сотрудников' : t({ ru: 'Вход', en: 'Log In' })}</div>
        {!isStaff && <LanguageToggle />}
      </div>
      <div className="page" style={{ paddingBottom: 30 }}>
        <div className="card" style={{ marginTop: 8 }}>
          <form onSubmit={submit}>
            <label className="f">
              <span>Email</span>
              <input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="f">
              <span>{t({ ru: 'Пароль', en: 'Password' })}</span>
              <input className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy}>{t({ ru: 'Войти', en: 'Log In' })}</button>
          </form>
        </div>
        {isStaff ? (
          <p className="small muted" style={{ textAlign: 'center' }}>Требуется 2FA и IP из белого списка.</p>
        ) : (
          <p className="small muted" style={{ textAlign: 'center' }}>
            {t({ ru: 'Нет аккаунта?', en: 'No account?' })} <Link className="link" href="/register">{t({ ru: 'Зарегистрироваться', en: 'Sign up' })}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <Suspense>
        <LoginForm />
      </Suspense>
    </LanguageProvider>
  );
}
