// Backup copy of the session token, used only to recover from the iOS
// home-screen-app cookie bug (see /api/auth/refresh) — the cookie is still
// the primary session mechanism. Wrapped in try/catch because Safari can
// throw on localStorage access in some restricted/private contexts.
const KEY = 'kurs_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // ignore — worst case, the fallback simply won't be available
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
