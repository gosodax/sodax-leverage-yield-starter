import {
  unwrapResult,
  useLeverageYieldApiPosition,
  useLeverageYieldPosition,
  useReservesUsdFormat,
  useSodaxContext,
} from '@sodax/dapp-kit';
import type { Address, LeverageYieldVault } from '@sodax/types';
import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { ONE_SHARE } from '@/lib/format';
import type { UsdPrices } from '../lib/usd';
import { useTransport } from './transport';

/**
 * Vault reads that follow the SDK/API toggle.
 *
 * The page reads every vault at once with `useVaultStats`, so the list, "Your vaults" and the dialog share one
 * set of queries and totals are plain sums. The checkpoints read one vault at a time with the dapp-kit hooks
 * (`useLeverageYieldEffectiveApr`, `…TotalAssets`, `…PreviewRedeem`, `…ShareBalances`); these are the same SDK
 * calls (`sodax.leverageYield.*`) and their REST twins (`sodax.api.leverageYield.*`) under `useQueries`.
 * The API returns decimal strings; values are normalised to bigint either way.
 */

export type VaultApr = { effectiveNetAprRay: bigint; leverageMultiplierWad: bigint; stale: boolean };

/** Shares held for one source network (each network has its own SODAX hub wallet on Sonic). */
export type Holding = { chainKey: SourceChainKey; holder: Address; shares: bigint };

/** One read with the flags the UI needs: a skeleton while loading, "–" on error. */
export type Read<T> = { data: T | undefined; isLoading: boolean; isError: boolean };

export type VaultStats = {
  apr: Read<VaultApr>;
  /** Total assets, in the vault's underlying asset. */
  tvl: Read<bigint>;
  /** Underlying asset per 1 share (previewRedeem of 1e18). */
  sharePrice: Read<bigint>;
  /** One entry per SOURCE_CHAINS network; `data` only once every network has loaded, so sums are never partial. */
  holdings: Read<Holding[]>;
};

/** APR, TVL and share price move slowly: the dapp-kit hooks' cadence. */
const STATS_REFETCH_MS = 60_000;
const SHARES_REFETCH_MS = 15_000;

function toRead<T>(query: UseQueryResult<T>): Read<T> {
  return { data: query.data, isLoading: query.isLoading, isError: query.isError };
}

export function useVaultStats(
  vaults: readonly LeverageYieldVault[],
  address: string | undefined,
): Map<Address, VaultStats> {
  const transport = useTransport();
  const { sodax } = useSodaxContext();
  const sdk = sodax.leverageYield;
  const api = sodax.api.leverageYield;

  const perVault = <T>(read: string, fn: (vault: Address) => Promise<T>) => ({
    queries: vaults.map(({ vault }) => ({
      queryKey: ['leverageYield', read, transport, vault],
      queryFn: () => fn(vault),
      refetchInterval: STATS_REFETCH_MS,
    })),
  });

  const aprs = useQueries(
    perVault('effectiveApr', async (vault): Promise<VaultApr> => {
      const apr =
        transport === 'sdk'
          ? unwrapResult(await sdk.getEffectiveApr(vault))
          : unwrapResult(await api.getEffectiveApr({ vault }));
      return {
        effectiveNetAprRay: BigInt(apr.effectiveNetAprRay),
        leverageMultiplierWad: BigInt(apr.leverageMultiplierWad),
        stale: apr.lsdApr.stale,
      };
    }),
  );
  const tvls = useQueries(
    perVault('totalAssets', async vault =>
      transport === 'sdk'
        ? unwrapResult(await sdk.getTotalAssets(vault))
        : BigInt(unwrapResult(await api.getTotalAssets({ vault })).totalAssets),
    ),
  );
  const sharePrices = useQueries(
    perVault('sharePrice', async vault =>
      transport === 'sdk'
        ? unwrapResult(await sdk.previewRedeem(vault, ONE_SHARE))
        : BigInt(unwrapResult(await api.previewRedeem({ vault, shares: ONE_SHARE.toString() })).assets),
    ),
  );

  // The hub wallet for (address, network) is derived with the SDK in both modes: there is no API route for it.
  const owner = address;
  const holdings = useQueries({
    queries: (owner ? vaults : []).flatMap(({ vault }) =>
      SOURCE_CHAINS.map(chainKey => ({
        // Under ['leverageYield', 'shareBalance'] so a finished deposit or withdraw refreshes it (useFlowProgress).
        queryKey: ['leverageYield', 'shareBalance', transport, vault, chainKey, owner],
        queryFn: async (): Promise<Holding> => {
          const holder = await sodax.hubProvider.getUserHubWalletAddress(owner as string, chainKey);
          const shares =
            transport === 'sdk'
              ? unwrapResult(await sdk.getShareBalance(vault, holder))
              : BigInt(unwrapResult(await api.getShareBalance({ vault, owner: holder })).balance);
          return { chainKey, holder, shares };
        },
        refetchInterval: SHARES_REFETCH_MS,
      })),
    ),
  });

  return new Map(
    vaults.map((vault, i): [Address, VaultStats] => {
      const mine = holdings.slice(i * SOURCE_CHAINS.length, (i + 1) * SOURCE_CHAINS.length);
      const loaded = mine.length > 0 && mine.every(query => query.data);
      return [
        vault.vault,
        {
          apr: toRead(aprs[i]),
          tvl: toRead(tvls[i]),
          sharePrice: toRead(sharePrices[i]),
          holdings: {
            data: loaded ? mine.map(query => query.data as Holding) : undefined,
            isLoading: mine.some(query => query.isLoading),
            isError: mine.some(query => query.isError),
          },
        },
      ];
    }),
  );
}

/** Health factor and LTV of the vault's leveraged position (only the dialog shows them). */
export function useVaultPosition(vault: Address): Read<{ healthFactor: bigint; ltv: bigint }> {
  const transport = useTransport();
  const sdk = useLeverageYieldPosition({ params: { vault: transport === 'sdk' ? vault : undefined } });
  const api = useLeverageYieldApiPosition({ params: { vault: transport === 'api' ? vault : undefined } });
  const query = transport === 'sdk' ? sdk : api;
  const position = query.data;
  return {
    data: position && { healthFactor: BigInt(position.healthFactor), ltv: BigInt(position.ltv) },
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * USD per whole token from the SODAX money market, keyed by lowercase reserve address (look up with `priceFor`).
 * Read with the SDK in both modes: the leverage-yield API has no prices. Display only.
 */
export function useUsdPrices(): UsdPrices {
  const { data } = useReservesUsdFormat({ queryOptions: { refetchInterval: STATS_REFETCH_MS } });
  return useMemo(
    () => new Map((data ?? []).map(reserve => [reserve.underlyingAsset.toLowerCase(), Number(reserve.priceInUSD)])),
    [data],
  );
}
