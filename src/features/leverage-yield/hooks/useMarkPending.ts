import { useEffect } from 'react';
import { setVaultPending } from '../lib/pending';

/** Marks a vault as having a flow in flight while `busy`, so "Your deposits" can show it as pending. */
export function useMarkPending(vaultName: string, busy: boolean) {
  useEffect(() => {
    if (!busy) return;
    setVaultPending(vaultName, true);
    return () => setVaultPending(vaultName, false);
  }, [vaultName, busy]);
}
