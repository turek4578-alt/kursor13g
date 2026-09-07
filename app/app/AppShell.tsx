'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import Toast from '@/components/Toast';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOn = (p: string) => pathname === p;
  return (
    <div className="shell cabinet">
      {children}
      <nav className="nav">
        <Link href="/app" className={isOn('/app') ? 'on' : ''}>{Icon.home}Главная</Link>
        <Link href="/app/wallets" className={pathname.startsWith('/app/wallets') ? 'on' : ''}>{Icon.wallet}Кошельки</Link>
        <Link href="/app/exchange" className={`mid ${isOn('/app/exchange') ? 'on' : ''}`}><span className="c">{Icon.swap}</span>Обмен</Link>
        <Link href="/app/withdraw" className={pathname.startsWith('/app/withdraw') ? 'on' : ''}>{Icon.withdraw}Вывод</Link>
        <Link href="/app/history" className={isOn('/app/history') ? 'on' : ''}>{Icon.hist}История</Link>
        <Link href="/app/profile" className={pathname.startsWith('/app/profile') ? 'on' : ''}>{Icon.user}Профиль</Link>
      </nav>
      <Toast />
    </div>
  );
}
