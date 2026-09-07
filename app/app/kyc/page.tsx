'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '../useMe';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/imageCompress';

export default function KycPage() {
  const { me, loading, reload } = useMe();
  const router = useRouter();
  const [docPhoto, setDocPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  if (loading || !me) return <><div className="topbar"><button className="back" onClick={() => router.back()}>‹</button><div className="title">Верификация</div></div><div className="page" /></>;

  async function readFile(f: File | undefined, set: (v: string) => void) {
    if (!f) return;
    try {
      const compressed = await compressImage(f);
      set(compressed);
    } catch {
      setErr('Не удалось обработать фото — попробуйте другое изображение');
    }
  }

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      await api('/api/kyc', { method: 'POST', body: JSON.stringify({ documentPhoto: docPhoto, selfiePhoto }) });
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const lvl = (n: number, t: string, req: string, lim: string) => (
    <div className="li" key={n}>
      <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#DFFBEA', color: 'var(--amber-ink)', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', fontWeight: 600, flex: 'none' }}>
        L{n}
      </div>
      <div className="grow">
        <div className="t1">{t}</div>
        <div className="t2">{req} · {lim}</div>
      </div>
      {me.kycLevel >= n && <span className="st st-approved">✓</span>}
    </div>
  );

  const uploadSlot = (label: string, hint: string, value: string | null, set: (v: string) => void, ref: React.RefObject<HTMLInputElement | null>) => (
    <div style={{ marginBottom: 16 }}>
      <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div className="small muted" style={{ marginBottom: 8 }}>{hint}</div>
      <label
        style={{ border: '2px dashed #C9D2DE', borderRadius: 14, padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, background: '#fff', cursor: 'pointer', display: 'block' }}
      >
        {value ? <img src={value} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 10 }} /> : (
          <>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
            Нажмите, чтобы сделать фото<br />или выбрать из галереи
          </>
        )}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => readFile(e.target.files?.[0], set)} />
      </label>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/profile')}>‹</button>
        <div className="title">Верификация</div>
      </div>
      <div className="page">
        <div className="card" style={{ padding: '4px 16px' }}>
          {lvl(0, 'Базовый', 'EMAIL', 'лимит $1 000')}
          {lvl(1, 'Подтвержденный', 'Документ+селфи', 'лимит $50 000')}
        </div>

        {me.kycStatus === 'approved' && me.kycLevel >= 1 ? (
          <div className="banner green">Верификация пройдена.</div>
        ) : me.kycStatus === 'pending' ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 12, letterSpacing: '.1em', color: 'var(--muted)' }}>НА ПРОВЕРКЕ</div>
            <div className="small muted" style={{ marginTop: 10 }}>
              Документ и селфи отправлены. Сотрудник проверит их и подтвердит уровень — обычно в течение рабочего дня.
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>Уровень 1 — документ и селфи</h3>
            <p className="small muted" style={{ marginBottom: 12 }}>
              Нужны два фото: разворот документа и селфи для сверки.
            </p>
            {uploadSlot('1. Документ', 'Паспорт или водительское удостоверение, разворот с фото', docPhoto, setDocPhoto, docRef)}
            {uploadSlot('2. Селфи', 'Ваше лицо крупным планом, при хорошем освещении', selfiePhoto, setSelfiePhoto, selfieRef)}
            {me.kycStatus === 'rejected' && <div className="err" style={{ marginBottom: 8 }}>Предыдущая попытка отклонена. Проверьте, что фото чёткие, и отправьте снова.</div>}
            {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
            <button className="btn" disabled={!docPhoto || !selfiePhoto || busy} onClick={submit}>Отправить на проверку</button>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Срок рассмотрения</h3>
          <div className="small muted">
            Предположительное время рассмотрения — от 10 минут до 5 часов.
          </div>
        </div>
      </div>
    </>
  );
}
