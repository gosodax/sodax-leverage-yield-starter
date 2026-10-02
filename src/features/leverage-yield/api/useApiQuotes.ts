import { useLeverageYieldApiDepositQuote, useLeverageYieldApiWithdrawQuote } from '@sodax/dapp-kit';
import type { LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { retryUnlessClientError } from '../lib/errors';
import { type QuoteState, quoteState } from '../lib/quote';
import { toBigInt } from './wire';

/** API version of useDepositQuote (same return shape). POST /leverage-yield/quote/deposit. */
export function useApiDepositQuote({
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
  const debounced = useDebouncedValue(inputAmount);
  const body = useMemo(
    () =>
      vault && token && debounced && debounced > 0n
        ? {
            vault: vault.vault,
            tokenSrc: token.address,
            tokenSrcChainKey: srcChainKey,
            amount: debounced.toString(),
            quoteType: 'exact_input' as const,
          }
        : undefined,
    [vault, token, srcChainKey, debounced],
  );
  const query = useLeverageYieldApiDepositQuote({
    params: { body },
    // A 4xx such as "Input amount too low" won't change on retry: show it now, refetch on the usual interval.
    queryOptions: { refetchInterval: REFETCH_MS, retry: retryUnlessClientError },
  });
  return quoteState({
    amountOut: toBigInt(query.data?.quotedAmount),
    error: query.error,
    typing: inputAmount !== debounced,
    waiting: !!body && query.isFetching && !query.data,
    refetch: query.refetch,
  });
}

/** API version of useWithdrawQuote (same return shape). POST /leverage-yield/quote/withdraw. */
export function useApiWithdrawQuote({
  vault,
  srcChainKey,
  dstChainKey,
  outputToken,
  shares,
}: {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  dstChainKey: SpokeChainKey;
  outputToken: XToken | undefined;
  shares: bigint | undefined;
}): QuoteState {
  const debounced = useDebouncedValue(shares);
  const body = useMemo(
    () =>
      outputToken && debounced && debounced > 0n
        ? {
            vault: vault.vault,
            srcChainKey, // the API takes the signing chain here (the SDK quote uses Sonic instead)
            tokenDst: outputToken.address,
            tokenDstChainKey: dstChainKey,
            amount: debounced.toString(),
            quoteType: 'exact_input' as const,
          }
        : undefined,
    [vault, srcChainKey, dstChainKey, outputToken, debounced],
  );
  const query = useLeverageYieldApiWithdrawQuote({
    params: { body },
    // A 4xx such as "Input amount too low" won't change on retry: show it now, refetch on the usual interval.
    queryOptions: { refetchInterval: REFETCH_MS, retry: retryUnlessClientError },
  });
  return quoteState({
    amountOut: toBigInt(query.data?.quotedAmount),
    error: query.error,
    typing: shares !== debounced,
    waiting: !!body && query.isFetching && !query.data,
    refetch: query.refetch,
  });
}
