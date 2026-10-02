import {
  type LeverageYieldShareHolding,
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
  useReservesUsdFormat,
  useSodaxContext,
} from '@sodax/dapp-kit';
import type { Address, LeverageYieldVault } from '@sodax/sdk';
import { useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { ONE_SHARE } from '@/lib/format';

export const SHARE_DECIMALS = 18;
const WAD = 10n ** 18n;

export type VaultMeta = {
  vault: LeverageYieldVault;
  shareSymbol: string;
  assetSymbol: string;
  assetName: string;
  assetDecimals: number;
  lsdLabel: string | undefined;
};

/** The vault registry with display metadata. Static SDK config, so no query. */
export function useVaults(): VaultMeta[] {
  const { sodax } = useSodaxContext();
  return useMemo(
    () =>
      sodax.leverageYield.listVaults().map(vault => {
        const share = sodax.config.getXTokenFromHubAsset(vault.vault);
        const asset = sodax.config.getXTokenFromHubAsset(vault.asset);
        return {
          vault,
          shareSymbol: share?.symbol ?? vault.name,
          assetSymbol: asset?.symbol ?? vault.name.replace(/^lsoda/, ''),
          assetName: asset?.name ?? vault.name,
          assetDecimals: asset?.decimals ?? 18,
          lsdLabel: vault.lsdSource?.label,
        };
      }),
    [sodax],
  );
}

/** USD per whole token, keyed by money-market reserve (a vault asset, or an XToken's `vault`). Display only. */
export function useUsdPrice(): (reserve: string | undefined) => number | undefined {
  const { data: reserves } = useReservesUsdFormat();
  const prices = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reserves ?? []) map.set(r.underlyingAsset.toLowerCase(), Number(r.priceInUSD));
    return map;
  }, [reserves]);
  return useCallback(
    (reserve: string | undefined) => (reserve ? prices.get(reserve.toLowerCase()) : undefined),
    [prices],
  );
}

export function toUsd(amount: bigint | undefined, decimals: number, price: number | undefined): number | undefined {
  if (amount === undefined || price === undefined) return undefined;
  return Number(formatUnits(amount, decimals)) * price;
}

/** Live vault reads. Hook default intervals are kept on purpose (each APR read is several Sonic calls). */
export function useVaultStats(vault: Address) {
  const apr = useLeverageYieldEffectiveApr({ params: { vault } });
  const tvl = useLeverageYieldTotalAssets({ params: { vault } });
  const position = useLeverageYieldPosition({ params: { vault } });
  const pricePerShare = useLeverageYieldPreviewRedeem({ params: { vault, shares: ONE_SHARE } });
  return {
    apr: apr.data,
    tvl: tvl.data,
    position: position.data,
    pricePerShare: pricePerShare.data,
    isLoading: apr.isLoading || tvl.isLoading,
    isError: apr.isError && tvl.isError,
  };
}

/** Exposure the depositor holds, in WAD: 1 + the borrowed multiple. */
export const exposureWad = (leverageMultiplierWad: bigint): bigint => WAD + leverageMultiplierWad;

/** Asset units for `shares`, given previewRedeem(1 share). */
export const shareValue = (shares: bigint, pricePerShare: bigint): bigint => (shares * pricePerShare) / WAD;

export type ShareHoldings = {
  /** One row per source network that holds shares (shares live in that network's hub wallet). */
  rows: LeverageYieldShareHolding[];
  total: bigint;
  isLoading: boolean;
};

/** The user's shares in one vault, per source network. */
export function useShareHoldings(vault: Address, address: string | undefined): ShareHoldings {
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const queries = useLeverageYieldShareBalances({ params: { vault, holders } });
  const rows = queries.flatMap(q => (q.data && q.data.shares > 0n ? [q.data] : []));
  return {
    rows,
    total: rows.reduce((sum, r) => sum + r.shares, 0n),
    isLoading: !!address && queries.some(q => q.isLoading),
  };
}

export function sharesOn(holdings: ShareHoldings, chainKey: SourceChainKey): bigint {
  return holdings.rows.find(r => r.chainKey === chainKey)?.shares ?? 0n;
}
