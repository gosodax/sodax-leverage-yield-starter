import { isNoRouteRefusal } from '@sodax/sdk';
import { type LeverageYieldVault, sonicSupportedTokens, type XToken } from '@sodax/types';

/** lsoda* vault shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

const hubTokenByAddress = new Map(
  (Object.values(sonicSupportedTokens) as XToken[]).map(token => [token.address.toLowerCase(), token]),
);

/** The vault's underlying asset on Sonic (its `asset`), e.g. lsodaWSTETH → wstETH. TVL and share price are in it. */
export function underlying(vault: LeverageYieldVault): { symbol: string; decimals: number } {
  const asset = hubTokenByAddress.get(vault.asset.toLowerCase());
  return { symbol: asset?.symbol ?? vault.name.replace(/^lsoda/, ''), decimals: asset?.decimals ?? SHARE_DECIMALS };
}

/** Yield source, e.g. "Sky (sUSDS)" → "Sky". */
export function yieldSource(vault: LeverageYieldVault): string {
  return vault.lsdSource?.label.replace(/\s*\([^)]*\)\s*/, '').trim() ?? '';
}

/** Human-readable message for a failed quote (solver refusal or SodaxError). */
export function quoteErrorMessage(error: unknown): string {
  if (isNoRouteRefusal(error)) return 'No route for this amount right now. Retrying shortly; a larger amount may work.';
  const e = error as { detail?: { message?: string }; message?: string };
  const message = e?.detail?.message ?? e?.message ?? 'Quote failed';
  if (/amount too low/i.test(message)) return 'Amount too low. Try at least ~$2.';
  return message;
}
