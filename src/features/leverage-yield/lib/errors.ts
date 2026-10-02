import { isUserRejectedError } from '@sodax/dapp-kit';
import { isNoRouteRefusal, isSodaxError } from '@sodax/sdk';

type SolverRefusal = { detail?: { code?: number; message?: string } };

/**
 * A quote failure as one line for the form. Solver refusals ("no path", thin liquidity, amount too low) are expected
 * UI branches, so they get friendly copy; SDK errors are discriminated on `code`, never on the message.
 */
export function quoteErrorMessage(error: unknown): string {
  if (isNoRouteRefusal(error)) return 'No route right now: solvers are rebalancing. Retrying automatically…';
  if (isSodaxError(error)) {
    switch (error.code) {
      case 'VALIDATION_FAILED':
        return 'This amount can’t be quoted. Try a larger amount.';
      case 'LOOKUP_FAILED':
        return 'This token isn’t supported for this route.';
      default:
        return 'Quote unavailable right now. Retrying…';
    }
  }
  const detail = (error as SolverRefusal | undefined)?.detail;
  if (detail?.message) {
    if (/too low|too small|minimum/i.test(detail.message)) return 'Amount too low. Deposit at least ~$2.';
    return detail.message;
  }
  return 'Quote unavailable right now. Retrying…';
}

/**
 * A failed approve / vault swap as one line, or `undefined` when the user simply rejected in their wallet (not an
 * error worth shouting about).
 */
export function txErrorMessage(error: unknown): string | undefined {
  if (isUserRejectedError(error)) return undefined;
  if (isSodaxError(error)) {
    switch (error.code) {
      case 'USER_REJECTED':
        return undefined;
      case 'VALIDATION_FAILED':
        return 'Simulation reverted: the transaction would fail. Check your balance and gas on this network.';
      case 'INTENT_CREATION_FAILED':
        return 'Couldn’t create the intent. Check your balance and gas, then try again.';
      case 'APPROVE_FAILED':
        return 'The approval failed. Try again.';
      case 'ALLOWANCE_CHECK_FAILED':
        return 'Couldn’t read your token allowance. Try again in a moment.';
      case 'TX_VERIFICATION_FAILED':
      case 'TX_SUBMIT_FAILED':
        return 'The transaction didn’t confirm on-chain. Check your wallet activity before retrying.';
      case 'RELAY_TIMEOUT':
        return 'Delivery to Sonic is taking longer than usual. Your funds are safe; check your position in a few minutes.';
      case 'RELAY_FAILED':
        return 'Delivery to Sonic failed. Your funds are safe; check your position before retrying.';
      case 'EXECUTION_FAILED':
      case 'EXTERNAL_API_ERROR':
        return 'The intent landed but the solver couldn’t be reached. It may still fill; check your position shortly.';
      default:
        return 'Something went wrong. Try again.';
    }
  }
  return 'Something went wrong. Try again.';
}
