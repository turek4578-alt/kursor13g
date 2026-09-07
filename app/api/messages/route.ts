import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbAll, dbRun } from '@/lib/db';

export async function GET() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const rows = await dbAll(`SELECT * FROM admin_messages WHERE user_id=? ORDER BY created_at DESC`, [u.id]);
  return NextResponse.json({ messages: rows });
}

export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { id } = await req.json();
  await dbRun(`UPDATE admin_messages SET read_at = datetime('now') WHERE id=? AND user_id=?`, [id, u.id]);
  return NextResponse.json({ ok: true });
}
