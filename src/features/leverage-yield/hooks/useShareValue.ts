import { useLeverageYieldPreviewRedeem } from '@sodax/dapp-kit';
import type { Address } from '@sodax/types';
import { ONE_SHARE } from '@/lib/format';

/** Share price: underlying asset per 1 lsoda* share (ERC-4626 previewRedeem of 1e18). */
export function useSharePrice(vault: Address): bigint | undefined {
  return useLeverageYieldPreviewRedeem({ params: { vault, shares: ONE_SHARE } }).data;
}

/**
 * Value of `shares` in the vault's underlying asset. Derived from the share price (ERC-4626 conversion is
 * linear), so every caller shares one cached query instead of one per share amount.
 */
export function useShareValue(vault: Address, shares: bigint | undefined): bigint | undefined {
  const price = useSharePrice(vault);
  return shares !== undefined && price !== undefined ? (shares * price) / ONE_SHARE : undefined;
}
