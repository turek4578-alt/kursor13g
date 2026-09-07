import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { dbAll, dbGet } from './db';
import { COINS } from './coins';

const SECRET = process.env.SESSION_SECRET || 'change-me-in-production-please';
const COOKIE = 'kurs_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}
export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}

// Returns the raw JWT too (not just setting the cookie) so callers like
// /api/auth/login and /api/auth/refresh can hand it to the client for a
// localStorage backup. iOS home-screen ("Add to Home Screen") web apps run
// in an isolated WebKit storage container that has a documented WebKit bug
// (see bugs.webkit.org #272325) where this cookie can silently vanish even
// before its real 30-day expiry — the localStorage copy is what lets
// /api/auth/refresh quietly re-issue it without asking for the password
// again.
export async function createSession(user: SessionUser): Promise<string> {
  const token = jwt.sign(user, SECRET, { expiresIn: '30d' });
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE);
}

// Verifies a JWT string on its own, independent of the cookie jar — used
// by /api/auth/refresh to check a token handed back from localStorage.
export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireUser() {
  const s = await getSession();
  if (!s) return null;
  const u = await dbGet(`SELECT * FROM users WHERE id = ?`, [s.id]);
  return u || null;
}

export async function requireStaff() {
  const u = await requireUser();
  if (!u) return null;
  if (!['support', 'compliance', 'admin', 'superadmin'].includes(u.role)) return null;
  return u;
}

// Shared shaping of a DB user row into what the client expects — used by
// both /api/auth/me and /api/auth/refresh so the two never drift apart.
export async function clientUserPayload(u: any) {
  const balRows = await dbAll(`SELECT currency, amount FROM balances WHERE user_id = ?`, [u.id]);
  const balances: Record<string, number> = {};
  for (const c of Object.keys(COINS)) balances[c] = 0;
  for (const r of balRows) balances[r.currency] = r.amount;
  const refCountRow = await dbGet(`SELECT COUNT(*) as n FROM users WHERE referred_by = ?`, [u.id]);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    kycStatus: u.kyc_status,
    kycLevel: u.kyc_level,
    status: u.status,
    twofaEnabled: !!u.twofa_enabled,
    referralCode: u.referral_code,
    antiphishingCode: u.antiphishing_code,
    refCount: refCountRow?.n || 0,
    balances,
  };
}
