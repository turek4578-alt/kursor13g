import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { requireUser } from '@/lib/auth';
import { dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!u.twofa_enabled) return NextResponse.json({ ok: true });
  const { code } = await req.json();
  if (!code || !u.twofa_secret || !authenticator.verify({ token: String(code).trim(), secret: u.twofa_secret })) {
    return NextResponse.json({ error: 'Неверный код' }, { status: 400 });
  }
  await dbRun(`UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?`, [u.id]);
  return NextResponse.json({ ok: true });
}
