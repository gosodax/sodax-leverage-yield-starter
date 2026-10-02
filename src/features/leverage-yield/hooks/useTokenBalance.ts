import { useBalances } from '@sodax/dapp-kit';
import type { SpokeChainKey, XToken } from '@sodax/types';
import { REFETCH_MS } from '@/config/workshop';

/** Wallet balance of one token on one chain (smallest units), via the SDK. */
export function useTokenBalance(chainKey: SpokeChainKey, token: XToken | undefined, address: string | undefined) {
  const query = useBalances({
    params: { chainKey, tokens: token ? [token] : [], address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  return { balance: token ? query.data?.[token.address] : undefined, isLoading: query.isLoading };
}
