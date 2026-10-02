/** lsoda* vault shares are always 18 decimals, regardless of the underlying asset. */
export const SHARE_DECIMALS = 18;

/** Swiss overline label: mono, uppercase, wide tracking. Used for stat and table-head labels. */
export const OVERLINE = 'font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-subtle-foreground';

/**
 * Human-readable message for a failed leverage-yield quote. The error is either the solver's own
 * response (`{ detail: { code, message } }` — e.g. "no path found", "Input amount too low") or a
 * `SodaxError` (an `Error` with a stable `code`).
 */
export function describeQuoteError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: { message?: string } }).detail;
    if (detail?.message) return detail.message;
  }
  if (error instanceof Error) return error.message;
  return 'Quote unavailable right now.';
}
