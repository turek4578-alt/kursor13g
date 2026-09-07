import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbGet, dbRun } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const { userId, message } = await req.json();
  if (!message || !message.trim()) return NextResponse.json({ error: 'Введите текст сообщения' }, { status: 400 });
  const u = await dbGet(`SELECT email FROM users WHERE id=?`, [userId]);
  if (!u) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

  const id = randomUUID();
  await dbRun(`INSERT INTO admin_messages (id, user_id, admin_email, message) VALUES (?,?,?,?)`, [
    id,
    userId,
    staff.email,
    message.trim(),
  ]);
  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    staff.email,
    'message_sent',
    'user ' + u.email,
    message.trim().slice(0, 100),
  ]);
  return NextResponse.json({ ok: true });
}
