import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type SpokeChainKey, type XToken } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { type QuoteState, quoteState } from '../lib/quote';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Live deposit quote: `inputAmount` of `token` on `srcChainKey` → lsoda* shares of `vault`.
 *
 * Uses `useLeverageYieldQuote` (NOT `useQuote`): it deducts the leverage-yield fee, so the quote matches
 * what the vault intent will charge. Don't adjust the amount for fees yourself.
 */
export function useDepositQuote({
  vault,
  srcChainKey,
  token,
  inputAmount,
}: {
  vault: LeverageYieldVault | undefined;
  srcChainKey: SpokeChainKey;
  token: XToken | undefined;
  inputAmount: bigint | undefined;
}): QuoteState {
  const debouncedAmount = useDebouncedValue(inputAmount);

  const payload = useMemo(
    () =>
      vault && token && debouncedAmount && debouncedAmount > 0n
        ? {
            token_src: token.address,
            token_src_blockchain_id: srcChainKey,
            token_dst: vault.vault, // the vault address is the lsoda* share token, on the hub (Sonic)
            token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
            amount: debouncedAmount,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [vault, token, srcChainKey, debouncedAmount],
  );

  const query = useLeverageYieldQuote({
    params: { payload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const result = query.data; // SDK Result: branch on .ok

  return quoteState({
    amountOut: result?.ok ? result.value.quoted_amount : undefined,
    error: result && !result.ok ? result.error : undefined,
    typing: inputAmount !== debouncedAmount,
    waiting: !!payload && query.isFetching && !result,
    refetch: query.refetch,
  });
}
