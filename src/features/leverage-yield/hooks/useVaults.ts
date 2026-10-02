import { type LeverageYieldVault, useSodaxContext } from '@sodax/dapp-kit';
import { useMemo } from 'react';

/** Reads the configured vault registry once; live metrics are fetched by card-level hooks. */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}
