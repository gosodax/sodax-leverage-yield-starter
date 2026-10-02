import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useMemo } from 'react';

/** The vault registry: static SDK config, read synchronously (dapp-kit has no hook for it). */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}
