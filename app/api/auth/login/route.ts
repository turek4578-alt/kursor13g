import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { notifyAdminTelegram } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const u = await dbGet(`SELECT * FROM users WHERE email = ?`, [String(email).toLowerCase()]);
  if (!u || !verifyPassword(password, u.password_hash)) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }
  if (u.status === 'blocked') {
    return NextResponse.json({ error: 'Аккаунт заблокирован. Обратитесь в поддержку.' }, { status: 403 });
  }
  const token = await createSession({ id: u.id, email: u.email, name: u.name, role: u.role });
  // Only for regular customers — skip staff/admin so checking the admin
  // panel yourself doesn't spam the same Telegram chat every time.
  if (u.role === 'user') {
    await notifyAdminTelegram(`🔑 <b>Вход в кабинет</b>\n${u.email}`).catch(() => {});
  }
  return NextResponse.json({ ok: true, role: u.role, token });
}
