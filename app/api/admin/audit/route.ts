import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbAll } from '@/lib/db';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const rows = await dbAll(`SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 300`);
  return NextResponse.json({ log: rows });
}
