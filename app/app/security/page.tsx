'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useMe } from '../useMe';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

export default function SecurityPage() {
  const { me, loading, reload } = useMe();
  const router = useRouter();
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading || !me) return <><div className="topbar"><button className="back" onClick={() => router.back()}>‹</button><div className="title">Безопасность</div></div><div className="page" /></>;

  async function startSetup() {
    setErr('');
    const d = await api('/api/auth/2fa/setup', { method: 'POST' });
    setOtpauth(d.otpauth);
  }

  async function confirmSetup() {
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code: setupCode }) });
      toast('2FA включена');
      setOtpauth(null);
      setSetupCode('');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code: disableCode }) });
      toast('2FA выключена');
      setShowDisable(false);
      setDisableCode('');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/profile')}>‹</button>
        <div className="title">Безопасность</div>
      </div>
      <div className="page">
        <div className="card">
          <div className="row">
            <div>
              <h3>Двухфакторная защита (TOTP)</h3>
              <div className="small muted">Google Authenticator или Aegis</div>
            </div>
            {me.twofaEnabled ? (
              <span className="st st-approved">Включена</span>
            ) : (
              <span className="st st-pending">Выключена</span>
            )}
          </div>

          {!me.twofaEnabled && !otpauth && (
            <button className="btn sm" style={{ marginTop: 12 }} onClick={startSetup}>Включить</button>
          )}

          {!me.twofaEnabled && otpauth && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{ background: '#fff', padding: 10, borderRadius: 10 }}>
                  <QRCodeSVG value={otpauth} size={160} />
                </div>
              </div>
              <div className="hint" style={{ marginBottom: 10, textAlign: 'center' }}>
                Отсканируйте QR в приложении-аутентификаторе, затем введите код, который оно показывает.
              </div>
              <label className="f">
                <span>Код из приложения</span>
                <input className="in mono" inputMode="numeric" maxLength={6} value={setupCode} onChange={(e) => setSetupCode(e.target.value)} placeholder="000000" />
              </label>
              {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
              <button className="btn sm" disabled={busy || setupCode.length < 6} onClick={confirmSetup}>Подтвердить</button>
            </div>
          )}

          {me.twofaEnabled && !showDisable && (
            <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => setShowDisable(true)}>Отключить 2FA</button>
          )}

          {me.twofaEnabled && showDisable && (
            <div style={{ marginTop: 14 }}>
              <label className="f">
                <span>Введите код из приложения, чтобы отключить</span>
                <input className="in mono" inputMode="numeric" maxLength={6} value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="000000" />
              </label>
              {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
              <button className="btn sm danger" disabled={busy || disableCode.length < 6} onClick={confirmDisable}>Отключить</button>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Пароль</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>Смена пароля по email пока не подключена.</div>
          <button className="btn sm ghost" disabled>Сменить пароль</button>
        </div>
      </div>
    </>
  );
}
