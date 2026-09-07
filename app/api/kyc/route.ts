import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dbRun } from '@/lib/db';
import { notifyAdminTelegram } from '@/lib/telegram';

// Submits both required photos for real admin review — see
// /api/admin/users (GET ?id=) for the photos and
// /api/admin/users (POST action: kyc_approve / kyc_reject) for the
// decision. There is no automatic approval: a human at the platform must
// look at these before the account's limit increases.
//
// NOTE: photos are stored as-is (base64 data URLs), not encrypted at rest.
// See lib/crypto.ts if that's added back later — it was deliberately
// removed for now to avoid requiring KYC_ENCRYPTION_KEY before this could
// be tested end to end.
export async function POST(req: NextRequest) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { documentPhoto, selfiePhoto } = await req.json();
  if (!documentPhoto || !selfiePhoto) {
    return NextResponse.json({ error: 'Нужны оба фото — документ и селфи' }, { status: 400 });
  }

  await dbRun(`UPDATE users SET kyc_status = 'pending', kyc_photo_document = ?, kyc_photo_selfie = ? WHERE id = ?`, [
    documentPhoto,
    selfiePhoto,
    u.id,
  ]);
  await dbRun(`INSERT INTO audit_log (admin_email, action, entity, detail) VALUES (?,?,?,?)`, [
    'system',
    'kyc_submitted',
    'user ' + u.email,
    'Документ + селфи загружены, ожидает проверки администратором',
  ]);
  await notifyAdminTelegram(
    `🪪 <b>Заявка на верификацию (KYC)</b>\n${u.email}\nТребуется проверка в /admin/users.`
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
