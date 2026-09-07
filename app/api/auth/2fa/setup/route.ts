import { NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { requireUser } from '@/lib/auth';
import { dbRun } from '@/lib/db';

// Generates a new secret and stores it un-confirmed (twofa_enabled stays 0
// until /api/auth/2fa/verify checks a real code from the user's
// authenticator app against it). Calling this again before verifying just
// replaces the pending secret — nothing is "on" until verified.
export async function POST() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const secret = authenticator.generateSecret();
  await dbRun(`UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?`, [secret, u.id]);
  const otpauth = authenticator.keyuri(u.email, 'KURS', secret);
  return NextResponse.json({ secret, otpauth });
}
