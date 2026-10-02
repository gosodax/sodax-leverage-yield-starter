import { useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import type { Address } from 'viem';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';

export type ShareHolding = { chainKey: SourceChainKey; shares: bigint };

/** Vault shares held per source network. They sit in the SODAX hub wallet on Sonic derived from each network. */
export function useShareHoldings(vault: Address | undefined) {
  const { address } = useEvmWallet();
  const queries = useLeverageYieldShareBalances({
    params: {
      vault,
      holders: address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined,
    },
  });

  const holdings: ShareHolding[] = SOURCE_CHAINS.map((chainKey, index) => ({
    chainKey,
    shares: queries[index]?.data?.shares ?? 0n,
  }));
  const total = holdings.reduce((sum, holding) => sum + holding.shares, 0n);

  return { holdings, total, isLoading: queries.some(query => query.isLoading) };
}
