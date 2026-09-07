import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { notifyAdminTelegram } from '@/lib/telegram';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const { email, fullName, password, referralCode } = await req.json();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 });
  }
  const cleanName = (fullName || '').trim();
  if (!cleanName || !/^[A-Za-z\s\-']+$/.test(cleanName)) {
    return NextResponse.json({ error: 'Имя и фамилия — только латинскими буквами' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Пароль не короче 8 символов' }, { status: 400 });
  }
  const existing = await dbGet(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase()]);
  if (existing) {
    return NextResponse.json({ error: 'Этот email уже зарегистрирован' }, { status: 400 });
  }
  let referredBy: string | null = null;
  if (referralCode) {
    const ref = await dbGet(`SELECT id FROM users WHERE referral_code = ?`, [referralCode]);
    if (ref) referredBy = ref.id;
  }
  const id = randomUUID();
  const refSlug = cleanName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'USER';
  const refCode = 'KURS-' + refSlug + Math.floor(Math.random() * 90 + 10);
  const antiphish = 'KRS-' + Math.floor(1000 + Math.random() * 8999);
  // Email verification is disabled for now (no email provider wired up yet
  // — section 4.9 of the spec) — email_verified is set straight to 1 and
  // there's no code to enter. Re-enable by generating+emailing a code here
  // and going back to the two-step register->verify flow on the client.
  await dbRun(
    `INSERT INTO users (id, email, password_hash, name, referral_code, referred_by, antiphishing_code, email_verified)
     VALUES (?,?,?,?,?,?,?,1)`,
    [id, email.toLowerCase(), hashPassword(password), cleanName, refCode, referredBy, antiphish]
  );

  // TEMPORARY, testing-phase-only: every new signup gets the SAME shared
  // USDT/TRC20 address auto-assigned as their "real" deposit address,
  // instead of admin hand-assigning a unique one per user. This is only
  // safe because right now only one person (the site owner) is actually
  // sending money to it — /api/wallets/check-deposit credits whichever
  // user clicks "Проверить в блокчейне" first for ANY unclaimed transfer
  // to this address, with no way to tell which user a transfer was
  // actually meant for. The moment more than one real depositor exists,
  // this must go back to a unique address per user (remove this insert
  // and assign addresses individually via /admin/users, as before) —
  // otherwise one customer's deposit can be claimed by another.
  await dbRun(
    `INSERT OR IGNORE INTO wallet_overrides (user_id, coin, address, set_by) VALUES (?,?,?,?)`,
    [id, 'USDT', 'TLRGy6WTENQUCdV9jVYo62QC8dbmSqf41S', 'auto-signup-testing']
  );

  const token = await createSession({ id, email: email.toLowerCase(), name: cleanName, role: 'user' });
  await notifyAdminTelegram(
    `🆕 <b>Новая регистрация</b>\n${cleanName} — ${email.toLowerCase()}${referredBy ? '\nПришёл по реферальной ссылке' : ''}`
  ).catch(() => {});
  return NextResponse.json({ ok: true, token });
}
