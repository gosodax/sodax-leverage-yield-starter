import { useSyncExternalStore } from 'react';

/** Vaults (by name) with a deposit or withdrawal in flight in this tab. In memory only: on-chain state is the truth. */
const pending = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

export function setVaultPending(vaultName: string, busy: boolean) {
  const count = (pending.get(vaultName) ?? 0) + (busy ? 1 : -1);
  if (count > 0) pending.set(vaultName, count);
  else pending.delete(vaultName);
  version++;
  for (const listener of listeners) listener();
}

export function useVaultPending(vaultName: string): boolean {
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return pending.has(vaultName);
}
