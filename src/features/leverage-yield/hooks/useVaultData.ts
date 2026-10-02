import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
  useSodaxContext,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useMemo } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { ONE_SHARE } from '@/lib/format';

/** The vault registry is static SDK config, read synchronously. */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

const WAD = 10n ** 18n;

/** Live metrics for one vault. The SDK hooks refresh on their own (30–60s), slower than REFETCH_MS. */
export function useVaultStats(vault: LeverageYieldVault) {
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const tvl = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const price = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const position = useLeverageYieldPosition({ params: { vault: vault.vault } });

  const pos = position.data;
  const ltv = pos ? BigInt(pos.ltv) : undefined;
  return {
    aprRay: apr.data?.effectiveNetAprRay,
    tvl: tvl.data,
    sharePrice: price.data,
    /** 1 / (1 − LTV) as a WAD multiplier: collateral and debt are priced in different units, LTV is not. */
    leverageWad: ltv !== undefined && ltv < 10_000n ? (WAD * 10_000n) / (10_000n - ltv) : undefined,
    ltvBps: pos?.ltv,
    /** WAD; max uint means the vault has no debt. */
    healthFactor: pos && pos.debt > 0n ? pos.healthFactor : undefined,
    isLoading: apr.isLoading || tvl.isLoading,
  };
}

/** The user's shares in one vault, per source chain they deposited from. Shares sit in their SODAX hub wallet. */
export function useShares(vault: LeverageYieldVault, address: string | undefined) {
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const queries = useLeverageYieldShareBalances({ params: { vault: vault.vault, holders } });
  const byChain: { chainKey: SourceChainKey; shares: bigint }[] = [];
  for (const query of queries) {
    const holding = query.data;
    if (holding && holding.shares > 0n)
      byChain.push({ chainKey: holding.chainKey as SourceChainKey, shares: holding.shares });
  }
  return {
    byChain,
    total: byChain.reduce((sum, h) => sum + h.shares, 0n),
    isLoading: address !== undefined && queries.some(q => q.isLoading),
    refetch: () => Promise.all(queries.map(q => q.refetch())),
  };
}
