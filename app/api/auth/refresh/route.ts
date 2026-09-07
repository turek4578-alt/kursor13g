import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createSession, clientUserPayload } from '@/lib/auth';
import { dbGet } from '@/lib/db';

// Fallback re-login path for when the httpOnly session cookie is missing
// but the client still holds a copy of a previously-issued token in
// localStorage. Exists specifically for iOS "Add to Home Screen" web apps,
// whose isolated WebKit storage container has a documented bug where the
// cookie can vanish before its real 30-day expiry (bugs.webkit.org
// #272325). The token itself is the same JWT that was in the cookie, so
// this grants nothing a valid cookie wouldn't already have granted — it's
// re-verified and re-checked against the DB exactly like a normal session.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: null }));
  if (!token || typeof token !== 'string') return NextResponse.json({ user: null });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ user: null });

  const u = await dbGet(`SELECT * FROM users WHERE id = ?`, [payload.id]);
  if (!u || u.status === 'blocked') return NextResponse.json({ user: null });

  // Re-issue both the cookie (fixes the missing cookie for this visit) and
  // a fresh token with a renewed 30-day expiry (so the localStorage copy
  // stays valid on a sliding basis as long as the app keeps getting opened).
  const newToken = await createSession({ id: u.id, email: u.email, name: u.name, role: u.role });

  return NextResponse.json({ token: newToken, user: await clientUserPayload(u) });
}
