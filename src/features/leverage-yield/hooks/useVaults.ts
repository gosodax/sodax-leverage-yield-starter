import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useMemo } from 'react';

/**
 * The vault registry. dapp-kit has no vaults hook: the list is static SDK config, read synchronously.
 * (Don't use `useLeverageYieldApiVaults`; that is the REST API path.)
 */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

export function useVault(name: string | undefined): LeverageYieldVault | undefined {
  const vaults = useVaults();
  return vaults.find(vault => vault.name === name);
}
