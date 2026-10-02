import { type Address, useLeverageYieldQuote } from '@sodax/dapp-kit';
import type { SourceChainKey } from '@/config/workshop';
import { DEFAULT_SLIPPAGE_BPS, REFETCH_MS } from '@/config/workshop';
import { buildDepositQuotePayload, buildWithdrawQuotePayload, minimumOutputFromQuote } from '../lib/quote';

export function useDepositQuote(input: {
  vault: Address;
  token: Address | undefined;
  chain: SourceChainKey;
  amount: bigint | undefined;
}) {
  const payload =
    input.token && input.amount && input.amount > 0n
      ? buildDepositQuotePayload({
          inputToken: input.token,
          sourceChain: input.chain,
          vault: input.vault,
          inputAmount: input.amount,
        })
      : undefined;
  const query = useLeverageYieldQuote({ params: { payload }, queryOptions: { refetchInterval: REFETCH_MS } });
  return {
    ...query,
    minimum: query.data?.ok ? minimumOutputFromQuote(query.data.value.quoted_amount, DEFAULT_SLIPPAGE_BPS) : undefined,
  };
}

export function useWithdrawQuote(input: {
  vault: Address;
  token: Address | undefined;
  chain: SourceChainKey;
  shares: bigint | undefined;
}) {
  const payload =
    input.token && input.shares && input.shares > 0n
      ? buildWithdrawQuotePayload({
          outputToken: input.token,
          destinationChain: input.chain,
          vault: input.vault,
          shares: input.shares,
        })
      : undefined;
  const query = useLeverageYieldQuote({ params: { payload }, queryOptions: { refetchInterval: REFETCH_MS } });
  return {
    ...query,
    minimum: query.data?.ok ? minimumOutputFromQuote(query.data.value.quoted_amount, DEFAULT_SLIPPAGE_BPS) : undefined,
  };
}
