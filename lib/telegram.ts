// Sends a plain-text notification to the admin via Telegram — a free
// stand-in for SMS. Requires two environment variables:
//   TELEGRAM_BOT_TOKEN — from @BotFather on Telegram
//   TELEGRAM_CHAT_ID   — the admin's own chat id to send messages to
// If either is missing, this silently no-ops (logged once) rather than
// throwing — a missing notification should never block the underlying
// action (e.g. a withdrawal request) from succeeding.
//
// NOTE: written against Telegram's documented Bot API but not exercised
// live from this build environment (no outbound network access here).
export async function notifyAdminTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping notification:', text);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error('[telegram] send failed', res.status, await res.text());
    }
  } catch (e) {
    console.error('[telegram] send error', e);
  }
}
