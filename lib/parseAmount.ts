// Russian (and some other) keyboard layouts insert a comma for the decimal
// point on numeric input (e.g. typing "0.4" produces "0,4"). Plain
// parseFloat() stops at the first invalid character, so parseFloat("0,4")
// silently returns 0 instead of 0.4 — this single normalization step is
// used everywhere an amount is parsed, client and server side, so a comma
// never quietly zeroes out a real amount.
export function parseAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
