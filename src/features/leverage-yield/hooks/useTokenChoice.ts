import type { SpokeChainKey, XToken } from '@sodax/types';
import { useMemo, useState } from 'react';
import { DEFAULT_TOKEN_KEY, getDepositTokens, getTokenByKey } from '@/config/workshop';

/**
 * Token picker state for one chain: the user's pick while it's on this chain, else USDC, else the first token.
 * Switching chains falls back to the default automatically. With `isEligible`, the fallback skips tokens the wallet
 * can't use (USDC with no balance falls through to the first token it can).
 */
export function useTokenChoice(chainKey: SpokeChainKey, isEligible?: (token: XToken) => boolean) {
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [picked, setPicked] = useState<{ chainKey: SpokeChainKey; address: string }>();
  const token: XToken | undefined =
    (picked?.chainKey === chainKey ? tokens.find(t => t.address === picked.address) : undefined) ??
    [getTokenByKey(chainKey, DEFAULT_TOKEN_KEY), ...tokens].find(t => t && (!isEligible || isEligible(t))) ??
    getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ??
    tokens[0];
  return { tokens, token, pickToken: (address: string) => setPicked({ chainKey, address }) };
}
