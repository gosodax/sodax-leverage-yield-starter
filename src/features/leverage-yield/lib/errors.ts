import { isUserRejectedError } from '@sodax/dapp-kit';
import { isNoRouteRefusal } from '@sodax/sdk';

/**
 * One readable sentence for any SDK, solver or wallet error. The useful text lives in different places:
 * a solver refusal in `detail.message`, an HTTP failure in `body.message`, a SodaxError in `message` (often
 * just a code) with the real reason in `cause`. Never show a bare code.
 */
type ErrorLike = {
  message?: unknown;
  code?: unknown;
  cause?: unknown;
  body?: { message?: unknown; code?: unknown };
  detail?: { message?: unknown; code?: unknown };
};

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
const isCodeLike = (message: string) => /^[A-Z0-9_.-]+$/.test(message) || /^HTTP \d{3}\b/.test(message);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function errorMessage(error: unknown): string | undefined {
  const links = chain(error);
  const message =
    links.map(e => text(e.body?.message) ?? text(e.detail?.message)).find(Boolean) ??
    links.map(e => text(e.message)).find(m => m && !isCodeLike(m));
  if (message && /^(failed to fetch|networkerror|load failed)/i.test(message)) {
    return "Couldn't reach SODAX. Check your connection and try again.";
  }
  return message
    ?.replace(/^\w+ failed: /, '')
    .split('\n')[0]
    .slice(0, 220);
}

function codes(error: unknown): unknown[] {
  return chain(error).flatMap(e => [e.code, e.body?.code, e.detail?.code]);
}

export function quoteErrorMessage(error: unknown): string {
  const message = errorMessage(error) ?? '';
  if (isNoRouteRefusal(error) || /no route|no path|NO_PATH/i.test(message)) {
    return 'No route for this amount right now. Retrying automatically; a larger amount may work.';
  }
  if (/amount too low/i.test(message)) return 'Amount too low. Solvers need at least ~$2.';
  return message ? capitalize(message) : 'Quote failed. Retrying shortly.';
}

export function flowErrorMessage(error: unknown): string {
  const message = errorMessage(error) ?? '';
  if (isUserRejectedError(error) || /user rejected|rejected the request|denied transaction/i.test(message)) {
    return 'You rejected the request in your wallet. Nothing was sent.';
  }
  if (/simulation/i.test(message)) {
    return 'The transaction would fail on-chain (simulation reverted). Check your balance and gas, then retry.';
  }
  if (codes(error).includes('RELAY_TIMEOUT')) {
    return 'Delivery to Sonic is taking longer than usual. It may still complete; follow the explorer link.';
  }
  return message ? capitalize(message) : 'Something went wrong. Please try again.';
}
