import { useXBalances } from '@sodax/dapp-kit';
import type { XToken } from '@sodax/types';
import { useXService } from '@sodax/wallet-sdk-react';
import { zeroAddress } from 'viem';
import { NATIVE_GAS_RESERVE, REFETCH_MS, type SourceChainKey } from '@/config/workshop';

export const isNativeToken = (token: XToken | undefined): boolean =>
  !!token && token.address.toLowerCase() === zeroAddress;

/** Wallet balances of `tokens` on `chainKey`, keyed by token address. */
export function useTokenBalances(chainKey: SourceChainKey, tokens: XToken[], address: string | undefined) {
  const xService = useXService({ xChainType: 'EVM' });
  const { data, isLoading } = useXBalances({
    params: { xService, xChainId: chainKey, xTokens: tokens, address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  return { balances: data, isLoading: !!address && isLoading };
}

/** What can be deposited: the balance, less a gas reserve when it is the native token. */
export function spendable(token: XToken | undefined, balance: bigint | undefined, chainKey: SourceChainKey): bigint {
  if (!token || balance === undefined) return 0n;
  if (!isNativeToken(token)) return balance;
  const reserve = NATIVE_GAS_RESERVE[chainKey];
  return balance > reserve ? balance - reserve : 0n;
}
