import { isUserRejectedError } from '@sodax/dapp-kit';
import { isNoRouteRefusal, isSodaxError, type LeverageYieldQuoteParams } from '@sodax/sdk';

/** Human message for a failed `useLeverageYieldQuote`. */
export function quoteErrorMessage(error: unknown): string {
  if (isSodaxError(error)) {
    return error.code === 'VALIDATION_FAILED' ? `Check your input: ${error.message}` : error.message;
  }
  if (isNoRouteRefusal(error)) {
    // The solver answers "too low", "too high" and "no route" the same way.
    return 'No route for this amount right now. Deposits below about $2 are refused; otherwise try again shortly.';
  }
  const detail = (error as { detail?: { message?: string } } | undefined)?.detail;
  return detail?.message ?? 'The quote failed. Try again shortly.';
}

/** Human message for a failed wallet / SDK step, or undefined when the user simply rejected in the wallet. */
export function actionErrorMessage(error: unknown): string | undefined {
  if (isUserRejectedError(error)) return undefined;
  if (isSodaxError(error)) {
    if (error.code === 'INTENT_CREATION_FAILED') {
      return 'Simulation reverted: the transaction would fail. Check your balance and gas on the source network.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export type QuotePayload = LeverageYieldQuoteParams;
