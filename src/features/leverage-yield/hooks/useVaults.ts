import { type LeverageYieldShareHolder, useLeverageYieldShareBalances, useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault, SpokeChainKey } from '@sodax/types';
import { useEffect, useMemo, useState } from 'react';
import { SOURCE_CHAINS } from '@/config/workshop';

/** The vault registry. Static per SDK instance, so no query needed. */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

export type ShareHolding = { chainKey: SpokeChainKey; shares: bigint };

/**
 * The user's lsoda* shares in one vault, per source network. Shares live in the user's SODAX hub wallet on Sonic,
 * one per source network, never in the EOA, so we ask for every network the user may have deposited from.
 */
export function useVaultShares(vault: LeverageYieldVault | undefined, address: string | undefined) {
  const holders = useMemo<LeverageYieldShareHolder[] | undefined>(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const queries = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });

  const holdings: ShareHolding[] = queries.flatMap(q =>
    q.data ? [{ chainKey: q.data.chainKey, shares: q.data.shares }] : [],
  );
  const total = holdings.reduce((sum, h) => sum + h.shares, 0n);
  const isLoading = !!address && queries.some(q => q.isLoading);
  return { holdings, total, isLoading };
}

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
