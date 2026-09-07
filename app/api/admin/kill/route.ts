import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { dbGet, dbRun } from '@/lib/db';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const row = await dbGet(`SELECT value FROM settings WHERE key='kill_switch'`);
  return NextResponse.json({ killSwitch: row?.value === '1' });
}

export async function POST() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  const row = await dbGet(`SELECT value FROM settings WHERE key='kill_switch'`);
  const next = row?.value === '1' ? '0' : '1';
  await dbRun(`UPDATE settings SET value=? WHERE key='kill_switch'`, [next]);
  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    staff.email,
    'kill_switch',
    'platform',
    next === '1' ? 'ON' : 'OFF',
  ]);
  return NextResponse.json({ killSwitch: next === '1' });
}
