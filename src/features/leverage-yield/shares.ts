import { type LeverageYieldShareHolding, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import type { Address } from '@sodax/sdk';
import { useMemo } from 'react';
import { SOURCE_CHAINS } from '@/config/workshop';

/**
 * The user's shares in one vault, per source network. Shares live in the SODAX hub wallet on Sonic, one hub
 * wallet per (network, address), so a Base deposit and an Arbitrum deposit are separate balances.
 */
export function useVaultShares(vault: Address | undefined, address: string | undefined) {
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const queries = useLeverageYieldShareBalances({ params: { vault, holders } });
  const holdings = queries.map(q => q.data).filter((h): h is LeverageYieldShareHolding => !!h);
  const total = holdings.reduce((acc, h) => acc + h.shares, 0n);
  const isLoading = !!address && queries.some(q => q.isLoading);
  return { holdings, total, isLoading };
}
