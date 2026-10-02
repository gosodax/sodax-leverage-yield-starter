import { type LeverageYieldVault, sonicSupportedTokens, type XToken } from '@sodax/types';
import { formatTokenAmount, ONE_SHARE } from '@/lib/format';

/** lsoda* vault shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

const RAY = 10n ** 27n;

const hubTokenByAddress = new Map(
  (Object.values(sonicSupportedTokens) as XToken[]).map(token => [token.address.toLowerCase(), token]),
);

/** The vault's underlying asset on Sonic, e.g. lsodaWSTETH → wstETH. TVL and share price are denominated in it. */
export function underlying(vault: LeverageYieldVault): { symbol: string; decimals: number } {
  const asset = hubTokenByAddress.get(vault.asset.toLowerCase());
  return { symbol: asset?.symbol ?? vault.name.replace(/^lsoda/, ''), decimals: asset?.decimals ?? SHARE_DECIMALS };
}

/** What the vault earns on, e.g. "Lido" from "Lido (stETH)". */
export function yieldSource(vault: LeverageYieldVault): string {
  return vault.lsdSource?.label.replace(/\s*\([^)]*\)\s*/, '').trim() ?? '';
}

const TAGLINES: Record<string, string> = {
  lsodaWEETH: 'Looped EtherFi restaking yield',
  lsodaWSTETH: 'Looped Lido staking yield',
  lsodaJITOSOL: 'Looped Jito SOL staking yield',
  lsodaSUSDS: 'Looped Sky savings rate',
};

export function vaultTagline(vault: LeverageYieldVault): string {
  return TAGLINES[vault.name] ?? `Looped ${yieldSource(vault) || 'staking'} yield`;
}

/** "4.53 shares" / "1 share". */
export function formatShares(shares: bigint | undefined): string {
  const amount = formatTokenAmount(shares, SHARE_DECIMALS);
  return `${amount} ${amount === '1' ? 'share' : 'shares'}`;
}

/** Underlying value of `shares` at `sharePrice` (underlying per 1 share). ERC-4626 conversion is linear. */
export function shareValue(shares: bigint | undefined, sharePrice: bigint | undefined): bigint | undefined {
  return shares !== undefined && sharePrice !== undefined ? (shares * sharePrice) / ONE_SHARE : undefined;
}

/** RAY APR → plain fraction (0.0587 for 5.87%). Display maths only. */
export function aprFraction(aprRay: bigint | undefined): number | undefined {
  return aprRay === undefined ? undefined : Number((aprRay * 1_000_000n) / RAY) / 1_000_000;
}

export type HealthTone = 'success' | 'notice' | 'destructive';

/**
 * Health factor tone. The vaults run around HF ~1.2 by design, so 1.2 is "on target", not "risky".
 * Below 1.0 the AAVE position is liquidatable.
 */
export function healthTone(hfWad: bigint | undefined): HealthTone | undefined {
  if (hfWad === undefined) return undefined;
  if (hfWad >= 115n * 10n ** 16n) return 'success';
  if (hfWad >= 105n * 10n ** 16n) return 'notice';
  return 'destructive';
}

/** `type(uint256).max` = no debt. */
export function isInfiniteHealth(hfWad: bigint): boolean {
  return hfWad > 10n ** 30n;
}
