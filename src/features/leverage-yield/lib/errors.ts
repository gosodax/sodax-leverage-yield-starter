import { isUserRejectedError } from '@sodax/dapp-kit';
import { isNoRouteRefusal } from '@sodax/sdk';

type ErrorLike = { message?: unknown; code?: unknown; cause?: unknown; detail?: { message?: unknown } };

function chain(error: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let current = error;
  while (current && typeof current === 'object' && out.length < 6) {
    out.push(current as ErrorLike);
    current = (current as ErrorLike).cause;
  }
  return out;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

function message(error: unknown): string {
  const links = chain(error);
  const found =
    links.map(e => text(e.detail?.message)).find(Boolean) ??
    links.map(e => text(e.message)).find(m => m && !/^[A-Z0-9_.-]+$/.test(m));
  return (found ?? '')
    .replace(/^\w+ failed: /, '')
    .split('\n')[0]
    .slice(0, 200);
}

/** One sentence for a failed quote. */
export function quoteError(error: unknown): string {
  const msg = message(error);
  if (isNoRouteRefusal(error) || /no route|no path/i.test(msg)) {
    return 'No route for this amount right now. Retrying shortly; a larger amount may work.';
  }
  if (/amount too low/i.test(msg)) return 'Amount too low. Try at least ~$2.';
  return msg || 'Quote failed. Try again.';
}

/** One sentence for a failed approval, deposit or withdrawal. */
export function flowError(error: unknown): string {
  const msg = message(error);
  if (isUserRejectedError(error) || /user rejected|rejected the request|denied transaction/i.test(msg)) {
    return 'You rejected the request in your wallet.';
  }
  if (chain(error).some(e => e.code === 'RELAY_TIMEOUT')) {
    return 'Taking longer than usual to reach Sonic. It may still complete; check the explorer link.';
  }
  if (/simulation/i.test(msg)) return 'The transaction would fail on-chain. Check your balance and gas, then retry.';
  return msg || 'Something went wrong. Try again.';
}
