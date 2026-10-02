import { useSodaxContext } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { useEffect, useMemo, useState } from 'react';
import { MAX_SLIPPAGE_BPS } from '@/config/workshop';

/** lsoda* vault shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

/** Slippage choices offered in the forms; never above MAX_SLIPPAGE_BPS. */
export const SLIPPAGE_OPTIONS_BPS = [50, 100, 300].filter(bps => bps <= MAX_SLIPPAGE_BPS);

/** The vault registry bundled with the SDK (static config, no network call). */
export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

const UNDERLYING_LABELS: Record<string, string> = {
  WEETH: 'weETH',
  WSTETH: 'wstETH',
  JITOSOL: 'JitoSOL',
  SUSDS: 'sUSDS',
};

/** The token a vault levers, from its share symbol: lsodaWEETH → weETH. */
export function underlyingLabel(vaultName: string): string {
  const raw = vaultName.replace(/^lsoda/i, '');
  return UNDERLYING_LABELS[raw.toUpperCase()] ?? raw;
}

/** A readable message from an SDK error: the solver's own `{ detail: { message } }`, a SodaxError, or anything else. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const message = (error as { detail?: { message?: string } }).detail?.message;
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Something went wrong';
}

/** `value`, but only after it has stopped changing for `delayMs`. Keeps a quote from firing on every keystroke. */
export function useDebounced<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
