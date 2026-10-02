import { unwrapResult, useReservesUsdFormat, useSodaxContext } from '@sodax/dapp-kit';
import type { Address, LeverageYieldVault } from '@sodax/types';
import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { ONE_SHARE } from '@/lib/format';
import type { UsdPrices } from '../lib/usd';

/** The vault registry: static SDK config, read synchronously (a getter, not a Result). */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

/** Shares held under one source network (each network has its own SODAX hub wallet on Sonic). */
export type Holding = { vault: LeverageYieldVault; chainKey: SourceChainKey; shares: bigint };

export type Read<T> = { data: T | undefined; isLoading: boolean; isError: boolean };

export type VaultStats = {
  apr: Read<{ netAprRay: bigint; leverageWad: bigint; lsdLabel: string; stale: boolean; targetLtvBps: bigint }>;
  /** Total assets in the underlying asset. */
  tvl: Read<bigint>;
  /** Underlying per 1 share. */
  sharePrice: Read<bigint>;
  position: Read<{ healthFactor: bigint; ltv: bigint; targetLtvBps?: bigint }>;
};

/** APR, TVL, share price move slowly; the position (LTV / HF) a bit faster. Never below REFETCH_MS. */
const STATS_MS = 60_000;
const POSITION_MS = 30_000;
const SHARES_MS = 15_000;

function toRead<T>(query: UseQueryResult<T>): Read<T> {
  return { data: query.data, isLoading: query.isLoading, isError: query.isError };
}

/**
 * Live stats for every vault at once, so the cards, the portfolio and the forms share one set of queries.
 * Same SDK reads the per-vault dapp-kit hooks make (`sodax.leverageYield.*`), fanned out with `useQueries`.
 */
export function useVaultStats(vaults: readonly LeverageYieldVault[]): Map<Address, VaultStats> {
  const { sodax } = useSodaxContext();
  const ly = sodax.leverageYield;

  const fan = <T>(name: string, refetchInterval: number, fn: (vault: Address) => Promise<T>) => ({
    queries: vaults.map(({ vault }) => ({
      queryKey: ['ly', name, vault],
      queryFn: () => fn(vault),
      refetchInterval,
    })),
  });

  const aprs = useQueries(
    fan('effectiveApr', STATS_MS, async vault => {
      const apr = unwrapResult(await ly.getEffectiveApr(vault));
      return {
        netAprRay: apr.effectiveNetAprRay,
        leverageWad: apr.leverageMultiplierWad,
        lsdLabel: apr.lsdApr.label,
        stale: apr.lsdApr.stale,
        targetLtvBps: apr.targetLtvBps,
      };
    }),
  );
  const tvls = useQueries(fan('totalAssets', STATS_MS, async vault => unwrapResult(await ly.getTotalAssets(vault))));
  const prices = useQueries(
    fan('sharePrice', STATS_MS, async vault => unwrapResult(await ly.previewRedeem(vault, ONE_SHARE))),
  );
  const positions = useQueries(
    fan('position', POSITION_MS, async vault => {
      const p = unwrapResult(await ly.getPosition(vault));
      return { healthFactor: p.healthFactor, ltv: p.ltv };
    }),
  );

  return new Map(
    vaults.map((vault, i): [Address, VaultStats] => [
      vault.vault,
      {
        apr: toRead(aprs[i]),
        tvl: toRead(tvls[i]),
        sharePrice: toRead(prices[i]),
        position: {
          ...toRead(positions[i]),
          data: positions[i].data && { ...positions[i].data, targetLtvBps: aprs[i].data?.targetLtvBps },
        },
      },
    ]),
  );
}

/**
 * The user's shares in every vault, per source network. Deposits deliver lsoda* to the hub wallet derived from
 * (address, source network), so we read each pair. `loaded` only once every read is in, so totals are never partial.
 */
export function useHoldings(vaults: readonly LeverageYieldVault[], address: string | undefined) {
  const { sodax } = useSodaxContext();
  const pairs = address ? vaults.flatMap(vault => SOURCE_CHAINS.map(chainKey => ({ vault, chainKey }))) : [];
  const queries = useQueries({
    queries: pairs.map(({ vault, chainKey }) => ({
      queryKey: ['ly', 'shares', vault.vault, chainKey, address],
      queryFn: async (): Promise<Holding> => ({
        vault,
        chainKey,
        shares: unwrapResult(
          await sodax.leverageYield.getShareBalanceForUser(vault.vault, chainKey, address as string),
        ),
      }),
      refetchInterval: SHARES_MS,
    })),
  });
  const loaded = queries.length > 0 && queries.every(q => q.data);
  const all = queries.flatMap(q => (q.data ? [q.data] : []));
  return {
    loaded,
    isLoading: queries.some(q => q.isLoading),
    /** Every (vault, network) with shares > 0. */
    holdings: all.filter(h => h.shares > 0n),
    sharesOf: (vault: Address) => all.filter(h => h.vault.vault === vault).reduce((sum, h) => sum + h.shares, 0n),
  };
}

/** USD per whole token from the SODAX money market, keyed by lowercase reserve address. Display only. */
export function useUsdPrices(): UsdPrices {
  const { data } = useReservesUsdFormat({ queryOptions: { refetchInterval: STATS_MS } });
  return useMemo(
    () => new Map((data ?? []).map(reserve => [reserve.underlyingAsset.toLowerCase(), Number(reserve.priceInUSD)])),
    [data],
  );
}
