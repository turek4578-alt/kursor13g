'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LogoMark } from '@/components/Logo';
import Toast from '@/components/Toast';

const TABS: [string, string][] = [
  ['/admin', 'Сводка'],
  ['/admin/orders', 'Заявки'],
  ['/admin/deposits', 'Пополнения'],
  ['/admin/withdrawals', 'Заявки на вывод'],
  ['/admin/users', 'Пользователи'],
  ['/admin/pairs', 'Пары и спреды'],
  ['/admin/audit', 'Audit log'],
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api('/api/auth/me', { method: 'DELETE' });
    router.push('/login?staff=1');
  }

  return (
    <div className="adm">
      <aside className="side">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, letterSpacing: '.14em', padding: '6px 10px 16px' }}>
          <LogoMark />
          KURS
        </div>
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? 'on' : ''}>{label}</Link>
        ))}
        <div style={{ flex: 1 }} />
        <Link href="/">← На сайт</Link>
        <button onClick={logout}>Выйти</button>
      </aside>
      <main className="main">{children}</main>
      <Toast />
    </div>
  );
}
