import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';

export type Holding = { vault: LeverageYieldVault; chainKey: SourceChainKey; holder: string; shares: bigint };

/**
 * The user's vault shares across every vault and source network, read on-chain for their hub wallets. Same query keys
 * and reads as dapp-kit's useLeverageYieldShareBalances (what the vault and position cards use), so the cache is shared
 * and nothing is fetched twice. `holdings` lists only positions above zero; `loaded` is true once every read is back.
 */
export function useHoldings(vaults: readonly LeverageYieldVault[], address: string | undefined) {
  const { sodax } = useSodaxContext();
  const pairs = useMemo(() => vaults.flatMap(vault => SOURCE_CHAINS.map(chainKey => ({ vault, chainKey }))), [vaults]);
  const results = useQueries({
    queries: pairs.map(({ vault, chainKey }) => ({
      queryKey: ['leverageYield', 'shareBalance', vault.vault, chainKey, address],
      enabled: !!address,
      refetchInterval: 15_000,
      queryFn: async () => {
        if (!address) throw new Error('address is required');
        const holder = await sodax.hubProvider.getUserHubWalletAddress(address, chainKey);
        const result = await sodax.leverageYield.getShareBalance(vault.vault, holder);
        if (!result.ok) throw result.error;
        return { chainKey, holder, shares: result.value };
      },
    })),
  });

  const key = results.map(result => `${result.data?.shares ?? ''}:${result.isSuccess}`).join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed only when a balance or load state changes
  return useMemo(() => {
    const holdings: Holding[] = [];
    results.forEach((result, index) => {
      const pair = pairs[index];
      if (pair && result.data && result.data.shares > 0n) {
        holdings.push({ ...pair, holder: result.data.holder, shares: result.data.shares });
      }
    });
    return { holdings, loaded: !!address && results.every(result => !result.isLoading) };
  }, [key, pairs, address]);
}
