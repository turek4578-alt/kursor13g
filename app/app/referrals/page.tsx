'use client';
import { useRouter } from 'next/navigation';
import { useMe } from '../useMe';
import { toast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';

export default function ReferralsPage() {
  const { me, loading } = useMe();
  const router = useRouter();
  if (loading || !me) return null;
  const link = `https://kurs.app/r/${me.referralCode}`;
  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/profile')}>‹</button>
        <div className="title">Рефералы</div>
      </div>
      <div className="page">
        <div className="card dark">
          <div className="eyebrow" style={{ color: '#7c8b84' }}>Ваша ссылка</div>
          <div className="mono" style={{ fontSize: 14, margin: '6px 0 10px', wordBreak: 'break-all' }}>{link}</div>
          <button className="btn sm amber" onClick={async () => toast((await copyText(link)) ? 'Скопировано' : 'Не удалось скопировать — выделите ссылку вручную')}>Скопировать</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="kpi"><div className="v">{me.refCount}</div><div className="l">приглашённых</div></div>
          <div className="kpi"><div className="v">30%</div><div className="l">от комиссии KURS</div></div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Как начисляется</h3>
          <div className="small muted">30% нашей комиссии с каждого обмена приглашённого — пожизненно. Выплата в USDT на баланс каждый понедельник.</div>
        </div>
      </div>
    </>
  );
}
