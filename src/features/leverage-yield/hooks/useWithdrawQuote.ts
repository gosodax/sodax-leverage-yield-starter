import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type SpokeChainKey, type XToken } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { type QuoteState, quoteState } from '../lib/quote';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Live withdraw quote: `shares` of `vault` → `outputToken` on `dstChainKey`.
 * The source side is the vault on the hub: token_src = vault, token_src_blockchain_id = Sonic
 * (NOT the chain the user signs on, which the solver rejects as "unsupported token_src").
 */
export function useWithdrawQuote({
  vault,
  dstChainKey,
  outputToken,
  shares,
}: {
  vault: LeverageYieldVault;
  dstChainKey: SpokeChainKey;
  outputToken: XToken | undefined;
  shares: bigint | undefined;
}): QuoteState {
  const debouncedShares = useDebouncedValue(shares);
  const payload = useMemo(
    () =>
      outputToken && debouncedShares && debouncedShares > 0n
        ? {
            token_src: vault.vault,
            token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
            token_dst: outputToken.address,
            token_dst_blockchain_id: dstChainKey,
            amount: debouncedShares,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [vault, outputToken, dstChainKey, debouncedShares],
  );
  const query = useLeverageYieldQuote({
    params: { payload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const result = query.data;

  return quoteState({
    amountOut: result?.ok ? result.value.quoted_amount : undefined,
    error: result && !result.ok ? result.error : undefined,
    typing: shares !== debouncedShares,
    waiting: !!payload && query.isFetching && !result,
    refetch: query.refetch,
  });
}
