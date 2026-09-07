export const COIN_DECIMALS: Record<string, number> = {
  USDT: 2, USDC: 2, ETH: 5, BTC: 6, SOL: 3, TON: 3, TRX: 1,
};

export function fmt(n: number, coin?: string): string {
  const dec = coin && COIN_DECIMALS[coin] !== undefined ? COIN_DECIMALS[coin] : 2;
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: dec });
}

export function fmtRate(n: number): string {
  if (!n) return '0';
  const d = n >= 100 ? 2 : n >= 1 ? 4 : Math.min(10, Math.ceil(-Math.log10(n)) + 4);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: d });
}

export function usd(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function dt(d: string | number | Date): string {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_RU_CLIENT: Record<string, string> = {
  created: 'Создана',
  awaiting_payment: 'Ожидает оплаты',
  payment_detected: 'Платёж обнаружен',
  payment_review: 'Проверяется администратором',
  paid: 'Оплачена',
  processing: 'Исполняется',
  completed: 'Выполнена',
  expired: 'Истекла',
  cancelled: 'Отменена',
  on_hold_compliance: 'На проверке',
  refund_pending: 'Возврат',
  refunded: 'Возвращена',
  failed: 'Ошибка',
  pending: 'На проверке',
  approved: 'Подтверждён',
  rejected: 'Отклонён',
  none: 'Не пройден',
  active: 'Активен',
  blocked: 'Заблокирован',
};

export const LIMITS_CLIENT: Record<number, { m: number; label: string }> = {
  0: { m: 1000, label: 'до $1 000 за операцию' },
  1: { m: 50000, label: 'до $50 000 в месяц' },
};
