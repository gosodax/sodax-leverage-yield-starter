import { type LeverageYieldShareHolding, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import type { Address } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS, SOURCE_CHAINS } from '@/config/workshop';

export type VaultHoldings = {
  /** Rows with a non-zero balance, one per source network the user holds shares under. */
  rows: LeverageYieldShareHolding[];
  /** Total shares across all source networks. */
  totalShares: bigint;
  /** True until every per-network balance has resolved (so totals are never quietly partial). */
  loading: boolean;
  isError: boolean;
};

/**
 * The connected user's shares in one vault across every source network. Shares live in the per-network
 * hub wallet on Sonic, so we fan a balance read across SOURCE_CHAINS and aggregate.
 */
export function useVaultHoldings(vault: Address, address: string | undefined): VaultHoldings {
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const results = useLeverageYieldShareBalances({
    params: { vault, holders },
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  return useMemo(() => {
    const rows = results
      .map(result => result.data)
      .filter((row): row is LeverageYieldShareHolding => !!row && row.shares > 0n);
    return {
      rows,
      totalShares: results.reduce((sum, result) => sum + (result.data?.shares ?? 0n), 0n),
      loading: !!holders && results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
    };
  }, [results, holders]);
}
