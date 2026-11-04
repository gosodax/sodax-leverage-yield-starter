import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
  useReservesUsdFormat,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useMemo } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { ONE_SHARE } from '@/lib/format';
import type { UsdPrices } from '../lib/usd';

export type Holding = { chainKey: SourceChainKey; shares: bigint };

/**
 * Every live read for one vault. The dapp-kit hooks keep their default intervals (APR/TVL 60s, position 30s,
 * shares 15s); React Query dedupes by key, so several components can call this for the same vault for free.
 */
export function useVaultData(vault: LeverageYieldVault | undefined, address: string | undefined) {
  const params = { vault: vault?.vault };
  const apr = useLeverageYieldEffectiveApr({ params });
  const tvl = useLeverageYieldTotalAssets({ params });
  const position = useLeverageYieldPosition({ params });
  const sharePrice = useLeverageYieldPreviewRedeem({ params: { vault: vault?.vault, shares: ONE_SHARE } });

  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const balances = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const holdingsLoaded = !!holders && balances.every(q => q.data !== undefined);
  const holdings: Holding[] = holdingsLoaded
    ? balances.map((q, i) => ({ chainKey: SOURCE_CHAINS[i] as SourceChainKey, shares: q.data?.shares ?? 0n }))
    : [];
  const totalShares = holdingsLoaded ? holdings.reduce((sum, h) => sum + h.shares, 0n) : undefined;

  return { apr, tvl, position, sharePrice, holdings, holdingsLoaded, totalShares };
}

/** USD per whole token from the SODAX money market, keyed by lowercase reserve address. Display only. */
export function useUsdPrices(): UsdPrices {
  const { data } = useReservesUsdFormat({ queryOptions: { refetchInterval: 60_000 } });
  return useMemo(
    () => new Map((data ?? []).map(reserve => [reserve.underlyingAsset.toLowerCase(), Number(reserve.priceInUSD)])),
    [data],
  );
}
