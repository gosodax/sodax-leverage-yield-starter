import { useBalances } from '@sodax/dapp-kit';
import type { SpokeChainKey, XToken } from '@sodax/types';
import { REFETCH_MS } from '@/config/workshop';

export function useTokenBalance(chainKey: SpokeChainKey, token: XToken | undefined, address: string | undefined) {
  const query = useBalances({
    params: { chainKey, tokens: token ? [token] : [], address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  return token ? query.data?.[token.address] : undefined;
}
