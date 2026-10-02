import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import type { LeverageYieldQuoteParams } from '@sodax/sdk';
import { REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';
import { quoteErrorMessage } from '../lib/errors';

/**
 * Live quote for a vault deposit (vault as `token_dst`) or withdraw (vault as `token_src`), plus the minimum we'll
 * accept after slippage. The minimum is always derived from a live quote, never 0.
 */
export function useVaultQuote(payload: LeverageYieldQuoteParams | undefined, slippageBps: number) {
  const query = useLeverageYieldQuote({
    params: { payload },
    // dapp-kit refreshes quotes every 3s; a whole room shares one IP, so slow it down.
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const result = payload ? query.data : undefined;
  const quoted = result?.ok ? result.value.quoted_amount : undefined;
  const minOutput = quoted !== undefined && quoted > 0n ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const error = result && !result.ok ? quoteErrorMessage(result.error) : undefined;

  return {
    quoted,
    minOutput,
    error,
    isLoading: !!payload && query.isLoading,
    isFetching: !!payload && query.isFetching,
    refetch: query.refetch,
  };
}
