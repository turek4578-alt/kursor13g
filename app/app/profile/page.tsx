'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe } from '../useMe';
import { api } from '@/lib/api';
import { clearStoredToken } from '@/lib/session';
import { STATUS_RU_CLIENT, LIMITS_CLIENT } from '@/lib/format';

export default function ProfilePage() {
  const { me, loading } = useMe();
  const router = useRouter();

  if (loading || !me) return <><div className="topbar"><div className="title">Профиль</div></div><div className="page" /></>;

  async function logout() {
    await api('/api/auth/me', { method: 'DELETE' });
    clearStoredToken();
    router.push('/');
  }

  const item = (t: string, s: string, href: string, badge?: React.ReactNode) => (
    <Link href={href} className="li tap" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="grow">
        <div className="t1">{t}</div>
        <div className="t2">{s}</div>
      </div>
      {badge}
      <span style={{ color: '#B4BDCA', fontSize: 18 }}>›</span>
    </Link>
  );

  return (
    <>
      <div className="topbar"><div className="title">Профиль</div></div>
      <div className="page">
        <div className="card row">
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{me.name}</div>
            <div className="small muted">{me.email}</div>
          </div>
          <span className={`st st-${me.kycStatus}`}>{STATUS_RU_CLIENT[me.kycStatus]}</span>
        </div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {item('Верификация', `Уровень ${me.kycLevel} · ${LIMITS_CLIENT[me.kycLevel]?.label}`, '/app/kyc')}
          {item('Безопасность', me.twofaEnabled ? '2FA включена' : '2FA выключена', '/app/security', !me.twofaEnabled ? <span className="st st-pending">Включить</span> : undefined)}
          {item('Рефералы', `${me.refCount} приглашённых`, '/app/referrals')}
          {item('Поддержка', 'Ответ в среднем 1–3 часа', '/app/support')}
        </div>
        <button className="btn ghost" onClick={logout}>Выйти</button>
      </div>
    </>
  );
}
