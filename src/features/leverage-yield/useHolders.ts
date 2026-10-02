import type { LeverageYieldShareHolder } from '@sodax/dapp-kit';
import { useMemo } from 'react';
import { SOURCE_CHAINS } from '@/config/workshop';

/**
 * One holder per source network: shares live in a separate SODAX hub wallet per network and address, so a deposit
 * from Base and one from Arbitrum are two balances.
 */
export function useHolders(address: string | undefined): LeverageYieldShareHolder[] {
  return useMemo(() => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : []), [address]);
}
