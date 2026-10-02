import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import type { SpokeChainKey } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';
import { type QuoteProblem, quoteProblem } from '../lib/errors';
import { useDebounced } from './useDebounced';

export type VaultQuote = {
  /** Quoted output (shares for a deposit, token units for a withdraw). */
  amountOut: bigint | undefined;
  /** amountOut minus slippage. The only source of `minOutputAmount`; never 0. */
  minOut: bigint | undefined;
  problem: QuoteProblem | undefined;
  /** Amount typed but not yet quoted (debouncing or first fetch). */
  loading: boolean;
  /** Refetching in the background; the shown quote may move. */
  refreshing: boolean;
  updatedAt: number;
  refetch: () => void;
};

/**
 * Live vault quote via `useLeverageYieldQuote` (not `useQuote`): it deducts the leverage-yield fee, so the quote
 * matches what the vault intent will charge. The vault address is `token_dst` for a deposit and `token_src` for a
 * withdraw, always on Sonic. Polls at REFETCH_MS (the hook's default 3s is too fast for a shared room).
 */
export function useVaultQuote({
  srcToken,
  srcChainKey,
  dstToken,
  dstChainKey,
  amount,
  slippageBps,
}: {
  srcToken: string | undefined;
  srcChainKey: SpokeChainKey;
  dstToken: string | undefined;
  dstChainKey: SpokeChainKey;
  amount: bigint | undefined;
  slippageBps: number;
}): VaultQuote {
  const debounced = useDebounced(amount);
  const payload = useMemo(
    () =>
      srcToken && dstToken && debounced && debounced > 0n
        ? {
            token_src: srcToken,
            token_src_blockchain_id: srcChainKey,
            token_dst: dstToken,
            token_dst_blockchain_id: dstChainKey,
            amount: debounced,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [srcToken, srcChainKey, dstToken, dstChainKey, debounced],
  );

  const query = useLeverageYieldQuote({ params: { payload }, queryOptions: { refetchInterval: REFETCH_MS } });
  const result = payload ? query.data : undefined; // SDK Result: branch on .ok
  const amountOut = result?.ok ? result.value.quoted_amount : undefined;
  const minOut = amountOut && amountOut > 0n ? minAmountAfterSlippage(amountOut, slippageBps) : undefined;

  return {
    amountOut,
    minOut: minOut && minOut > 0n ? minOut : undefined,
    problem: result && !result.ok ? quoteProblem(result.error) : undefined,
    loading: (amount ?? 0n) > 0n && (amount !== debounced || (query.isFetching && !result)),
    refreshing: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    refetch: () => void query.refetch(),
  };
}
