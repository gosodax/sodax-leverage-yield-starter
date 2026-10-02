import { useReservesUsdFormat, useSodaxContext } from '@sodax/dapp-kit';
import { type LeverageYieldVault, tokenLogo } from '@sodax/types';
import { useMemo } from 'react';

export type VaultInfo = {
  /** Registry entry. `vault.vault` is the lsoda* proxy address and doubles as the share token. */
  vault: LeverageYieldVault;
  /** lsoda* share symbol, e.g. lsodaSUSDS. */
  shareSymbol: string;
  /** Underlying asset symbol, e.g. sUSDS. */
  assetSymbol: string;
  assetDecimals: number;
  logo: string;
};

/** The vault registry is static SDK config, so it is read synchronously; symbols come from the hub token config. */
export function useVaults(): VaultInfo[] {
  const { sodax } = useSodaxContext();
  return useMemo(
    () =>
      sodax.leverageYield.listVaults().map(vault => {
        const share = sodax.config.getXTokenFromHubAsset(vault.vault);
        const asset = sodax.config.getXTokenFromHubAsset(vault.asset);
        const assetSymbol = asset?.symbol ?? vault.name.replace(/^lsoda/, '');
        return {
          vault,
          shareSymbol: share?.symbol ?? vault.name,
          assetSymbol,
          assetDecimals: asset?.decimals ?? 18,
          logo: tokenLogo(assetSymbol),
        };
      }),
    [sodax],
  );
}

/**
 * USD per whole vault asset, from the money-market reserve prices (every vault asset is a reserve keyed by
 * `underlyingAsset`). Display only: never size a minimum output from it.
 */
export function useAssetUsdPrice(asset: string): number | undefined {
  const { data: reserves } = useReservesUsdFormat();
  return useMemo(() => {
    const reserve = reserves?.find(r => r.underlyingAsset.toLowerCase() === asset.toLowerCase());
    return reserve ? Number(reserve.priceInUSD) : undefined;
  }, [reserves, asset]);
}
