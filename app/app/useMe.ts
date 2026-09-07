'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredToken, setStoredToken, clearStoredToken } from '@/lib/session';

export type Me = {
  id: string; email: string; name: string; role: string;
  kycStatus: string; kycLevel: number; status: string; twofaEnabled: boolean;
  referralCode: string; antiphishingCode: string; refCount: number;
  balances: Record<string, number>;
};

export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    let data = await api('/api/auth/me');
    if (!data.user) {
      // The httpOnly cookie is missing — normally means "logged out", but
      // on an iOS home-screen app this can also mean the cookie was wiped
      // by the WebKit bug described in /api/auth/refresh while the token
      // itself is still perfectly valid. Try that before actually bouncing
      // to the login screen.
      const token = getStoredToken();
      if (token) {
        try {
          data = await api('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ token }) });
        } catch {
          data = { user: null };
        }
      }
    }
    if (!data.user) {
      clearStoredToken();
      router.push('/login');
      return;
    }
    if (data.token) setStoredToken(data.token);
    setMe(data.user);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    reload();
    // Admin actions (KYC approve/reject, balance adjustments, blocks) happen
    // in a separate session and don't push to this tab, so without polling
    // a user who keeps the app open never sees the update. Also refetch the
    // moment the tab regains focus, so switching back from e.g. checking
    // email after an approval feels instant instead of waiting out the poll.
    const t = setInterval(reload, 15000);
    const onFocus = () => reload();
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  return { me, loading, reload };
}
