import { useReservesUsdFormat, useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { useMemo } from 'react';

export type VaultInfo = LeverageYieldVault & {
  shareSymbol: string;
  assetSymbol: string;
  assetDecimals: number;
};

/** The vault registry (static SDK config) plus display metadata resolved from the hub token config. */
export function useVaults(): VaultInfo[] {
  const { sodax } = useSodaxContext();
  return useMemo(
    () =>
      sodax.leverageYield.listVaults().map(vault => {
        const share = sodax.config.getXTokenFromHubAsset(vault.vault);
        const asset = sodax.config.getXTokenFromHubAsset(vault.asset);
        return {
          ...vault,
          shareSymbol: share?.symbol ?? vault.name,
          assetSymbol: (asset?.symbol ?? vault.name.replace(/^lsoda/, '')).replace(/^soda/, ''),
          assetDecimals: asset?.decimals ?? 18,
        };
      }),
    [sodax],
  );
}

/** USD per whole vault asset, from the money-market reserve oracle (display only, never for minimums). */
export function useAssetUsdPrices(): (asset: string) => number | undefined {
  const { data: reserves } = useReservesUsdFormat();
  return useMemo(() => {
    const prices = new Map<string, number>();
    for (const r of reserves ?? []) prices.set(r.underlyingAsset.toLowerCase(), Number(r.priceInUSD));
    return (asset: string) => prices.get(asset.toLowerCase());
  }, [reserves]);
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}
