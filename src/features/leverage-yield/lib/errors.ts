import { isUserRejectedError } from '@sodax/dapp-kit';

/** Turn SDK / wallet errors into one short sentence for the UI. */
export function friendlyError(error: unknown): string {
  if (isUserRejectedError(error)) return 'You rejected the request in your wallet.';
  const e = error as { code?: string; message?: string; detail?: { message?: string } };
  const message = e?.detail?.message ?? e?.message ?? '';
  // Some wallet errors reach us raw (not wrapped as a SodaxError), e.g. from API-built approvals.
  if (/user rejected|rejected the request|denied transaction|code:? ?4001/i.test(message)) {
    return 'You rejected the request in your wallet.';
  }
  if (/simulation/i.test(message)) {
    return 'The transaction would fail on-chain (simulation reverted). Check your balance or shares and try again.';
  }
  switch (e?.code) {
    case 'RELAY_TIMEOUT':
      return 'This is taking longer than usual to reach Sonic. It may still complete; check the explorer link.';
    case 'INTENT_CREATION_FAILED':
      return `Could not create the transaction: ${message || 'unknown error'}`;
    default:
      // Wallet / viem errors can be very long; keep the first line.
      return message.split('\n')[0].slice(0, 240) || 'Something went wrong.';
  }
}
