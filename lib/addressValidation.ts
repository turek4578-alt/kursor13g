import { isValidTronAddress } from './tron';

// Format-only sanity checks (not checksum validation) — enough to reject an
// obviously-wrong placeholder like "1111...1" before it's saved as an
// override. A passing check does not confirm the address exists on-chain.
const VALIDATORS: Record<string, (a: string) => boolean> = {
  TRC20: isValidTronAddress,
  ERC20: (a) => /^0x[a-fA-F0-9]{40}$/.test(a),
  Bitcoin: (a) => /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a) || /^bc1[a-z0-9]{25,59}$/.test(a),
  Solana: (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a),
  TON: (a) => /^[EU]Q[A-Za-z0-9_-]{46}$/.test(a),
};

export function isValidAddressForNetwork(network: string, address: string): boolean {
  const check = VALIDATORS[network];
  return check ? check(address.trim()) : false;
}

// Coins with a working automated on-chain deposit checker (lib/tron.ts's
// getTrc20Transfers, wired up in /api/wallets/check-deposit). Everything
// else can still get a real admin-assigned address, but there is no
// automated way to confirm a deposit yet — the wallet UI must not offer a
// "check" button that pretends otherwise for these.
export const CHECKABLE_COINS = ['USDT'];
