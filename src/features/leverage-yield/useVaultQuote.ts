import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { isNoRouteRefusal, isSodaxError } from '@sodax/sdk';
import type { SolverIntentQuoteRequest } from '@sodax/types';
import { REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';

export type VaultQuote =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; quoted: bigint; minOutput: bigint }
  | { status: 'error'; message: string };

/**
 * Live vault quote (deposit when the vault is `token_dst`, withdraw when it is `token_src`) and the minimum
 * output derived from it. No partner fee on either the quote or the builders, so both resolve the same fee.
 */
export function useVaultQuote(payload: SolverIntentQuoteRequest | undefined, slippageBps: number) {
  const query = useLeverageYieldQuote({
    params: { payload },
    // The hook polls every 3s by default; the workshop floor is REFETCH_MS (a room shares one IP).
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  const quote = toVaultQuote(payload, slippageBps, query);

  /** Refetches before a build, so the minimum never comes from a quote that sat in a background tab. */
  const refresh = async (): Promise<VaultQuote> => toVaultQuote(payload, slippageBps, await query.refetch());

  return { quote, isFetching: query.isFetching, refresh };
}

function toVaultQuote(
  payload: SolverIntentQuoteRequest | undefined,
  slippageBps: number,
  query: Pick<ReturnType<typeof useLeverageYieldQuote>, 'isError' | 'error' | 'data'>,
): VaultQuote {
  if (!payload) return { status: 'idle' };
  if (query.isError) return { status: 'error', message: query.error?.message ?? 'The quote request failed.' };
  if (!query.data) return { status: 'loading' };
  if (!query.data.ok) return { status: 'error', message: quoteErrorMessage(query.data.error) };
  const quoted = query.data.value.quoted_amount;
  const minOutput = minAmountAfterSlippage(quoted, slippageBps);
  // A zero minimum accepts any fill; refuse to offer it.
  if (minOutput <= 0n)
    return { status: 'error', message: 'The quote is too small to set a safe minimum. Try a larger amount.' };
  return { status: 'ok', quoted, minOutput };
}

function quoteErrorMessage(error: unknown): string {
  if (isSodaxError(error)) {
    return error.code === 'VALIDATION_FAILED' ? `Check your input: ${error.message}` : error.message;
  }
  const solverMessage = (error as { detail?: { message?: string } }).detail?.message;
  // The solver answers "too low", "too high" and "no route" the same way, so name all three.
  if (isNoRouteRefusal(error)) {
    return `${solverMessage ?? 'No route right now'}. The amount may be too low (deposit at least about $2) or too high, or solvers are rebalancing. Retrying automatically.`;
  }
  return solverMessage ?? 'The solver could not quote this amount. Retrying automatically.';
}
