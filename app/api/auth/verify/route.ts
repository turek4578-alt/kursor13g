import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { userId, code } = await req.json();
  const u = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
  if (!u) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  if (u.verify_code !== code) {
    return NextResponse.json({ error: 'Код не совпадает' }, { status: 400 });
  }
  await dbRun(`UPDATE users SET email_verified = 1, verify_code = NULL WHERE id = ?`, [userId]);
  const token = await createSession({ id: u.id, email: u.email, name: u.name, role: u.role });
  return NextResponse.json({ ok: true, token });
}
