import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { requireUser } from '@/lib/auth';
import { dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { code } = await req.json();
  if (!u.twofa_secret) {
    return NextResponse.json({ error: 'Сначала отсканируйте QR-код' }, { status: 400 });
  }
  if (!code || !authenticator.verify({ token: String(code).trim(), secret: u.twofa_secret })) {
    return NextResponse.json({ error: 'Неверный код. Проверьте время на телефоне и попробуйте снова.' }, { status: 400 });
  }
  await dbRun(`UPDATE users SET twofa_enabled = 1 WHERE id = ?`, [u.id]);
  return NextResponse.json({ ok: true });
}
