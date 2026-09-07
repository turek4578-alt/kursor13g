import { NextResponse } from 'next/server';
import { requireUser, destroySession, clientUserPayload } from '@/lib/auth';

export async function GET() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({ user: await clientUserPayload(u) });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
