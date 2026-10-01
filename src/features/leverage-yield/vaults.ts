import type { LeverageYieldShareHolder } from '@sodax/dapp-kit';
import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { useMemo } from 'react';
import { SOURCE_CHAINS } from '@/config/workshop';

/** The vault registry bundled with the SDK. Synchronous: a config getter, not a Result. */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

/** 'lsodaSUSDS' → 'sUSDS', 'lsodaWEETH' → 'weETH': the asset a vault loops, for labels. */
export function underlyingSymbol(vaultName: string): string {
  const raw = vaultName.replace(/^lsoda/, '');
  const known: Record<string, string> = { WEETH: 'weETH', WSTETH: 'wstETH', JITOSOL: 'JitoSOL', SUSDS: 'sUSDS' };
  return known[raw] ?? raw;
}

/**
 * Every (network, address) pair the user may hold shares under. Shares live in a hub wallet derived from the
 * network and address the user deposited from, so each source network has its own balance.
 */
export function useShareHolders(address: string | undefined): LeverageYieldShareHolder[] | undefined {
  return useMemo(() => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined), [address]);
}
