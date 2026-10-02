import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { useMemo } from 'react';

/**
 * Static display metadata per vault `name`. The registry itself comes from
 * `sodax.leverageYield.listVaults()`; this only adds what the SDK doesn't carry: a human label,
 * the underlying asset's symbol (TVL and share price are denominated in it) and a one-liner.
 */
const VAULT_META: Record<string, { underlyingSymbol: string; description: string }> = {
  lsodaWEETH: { underlyingSymbol: 'weETH', description: 'Looped ether.fi wrapped eETH' },
  lsodaWSTETH: { underlyingSymbol: 'wstETH', description: 'Looped Lido wrapped stETH' },
  lsodaJITOSOL: { underlyingSymbol: 'JitoSOL', description: 'Looped Jito staked SOL' },
  lsodaSUSDS: { underlyingSymbol: 'sUSDS', description: 'Looped Sky savings USDS' },
};

export function vaultUnderlyingSymbol(name: string): string {
  return VAULT_META[name]?.underlyingSymbol ?? name.replace(/^lsoda/, '');
}

export function vaultDescription(name: string): string {
  return VAULT_META[name]?.description ?? 'Leveraged yield vault';
}

/** The lsoda* vault registry bundled with the SDK (synchronous config, no Result). */
export function useVaults(): LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => [...sodax.leverageYield.listVaults()], [sodax]);
}
