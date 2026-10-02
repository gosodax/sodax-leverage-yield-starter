import { type LeverageYieldVault, sonicSupportedTokens, type XToken } from '@sodax/types';
import { ONE_SHARE } from '@/lib/format';

/** lsoda* vault shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

const hubTokens = new Map(
  (Object.values(sonicSupportedTokens) as XToken[]).map(token => [token.address.toLowerCase(), token]),
);

/** The vault's underlying asset on Sonic: TVL and share price are quoted in it. */
export function underlying(vault: LeverageYieldVault): { symbol: string; decimals: number } {
  const token = hubTokens.get(vault.asset.toLowerCase());
  return { symbol: token?.symbol ?? vault.name.replace(/^lsoda/, ''), decimals: token?.decimals ?? SHARE_DECIMALS };
}

/** "Sky (sUSDS)" → "Sky". */
export function yieldSource(vault: LeverageYieldVault): string {
  return vault.lsdSource?.label.replace(/\s*\([^)]*\)\s*/, '').trim() ?? '';
}

/** Underlying value of `shares` at `sharePrice` (underlying per one share). */
export function shareValue(shares: bigint | undefined, sharePrice: bigint | undefined): bigint | undefined {
  return shares !== undefined && sharePrice !== undefined ? (shares * sharePrice) / ONE_SHARE : undefined;
}
