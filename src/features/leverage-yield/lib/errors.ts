import { isUserRejectedError } from '@sodax/dapp-kit';
import { isNoRouteRefusal } from '@sodax/sdk';

/**
 * Human text for SDK, solver, API and wallet errors. The useful message hides in different places: a solver
 * refusal in `detail.message`, an API failure in `cause.body.message`, a wallet error in `message`.
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

export function errorMessage(error: unknown): string | undefined {
  const links = chain(error);
  const message =
    links.map(e => text(e.body?.message) ?? text(e.detail?.message)).find(Boolean) ??
    links.map(e => text(e.message)).find(m => m && !isCodeLike(m));
  if (message && /^(failed to fetch|networkerror|load failed)/i.test(message)) {
    return "Couldn't reach the SODAX API. Check your connection and try again.";
  }
  return message
    ?.replace(/^\w+ failed: /, '')
    .split('\n')[0]
    .slice(0, 240);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type QuoteProblem = { kind: 'no-route' | 'too-low' | 'other'; message: string };

export function quoteProblem(error: unknown): QuoteProblem {
  const message = errorMessage(error) ?? '';
  if (/amount too low/i.test(message)) {
    return { kind: 'too-low', message: 'Amount too low. Solvers need roughly $2 or more.' };
  }
  if (isNoRouteRefusal(error) || /no route|no path|NO_PATH/i.test(message)) {
    return {
      kind: 'no-route',
      message: 'No route for this amount right now. Solvers may be rebalancing; retrying automatically.',
    };
  }
  return { kind: 'other', message: message ? capitalize(message) : 'The quote failed. Try again shortly.' };
}

export function isRejection(error: unknown): boolean {
  const message = errorMessage(error) ?? '';
  return isUserRejectedError(error) || /user rejected|rejected the request|denied transaction/i.test(message);
}

/** One sentence for a failed deposit or withdraw step. */
export function friendlyError(error: unknown): string {
  const message = errorMessage(error) ?? '';
  if (/simulation/i.test(message)) {
    return 'The transaction would fail on-chain (simulation reverted). Check your balance, gas or shares.';
  }
  const codes = chain(error).flatMap(e => [e.code, e.body?.code]);
  if (codes.includes('RELAY_TIMEOUT')) {
    return 'Delivery to Sonic is taking longer than usual. It may still complete; check the explorer link.';
  }
  if (codes.includes('INTENT_CREATION_FAILED')) return `Could not create the order: ${message || 'unknown error'}`;
  return message ? capitalize(message) : 'Something went wrong. Try again.';
}
