import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VaultQuote } from '../hooks/useVaultQuote';
import { InfoRow } from './InfoRow';

/** Value kept after fees + routing, as a fraction (0.985 = 1.5% cost). Display only; undefined without prices. */
export function valueRetained(inUsd: number | undefined, outUsd: number | undefined): number | undefined {
  return inUsd && outUsd !== undefined && inUsd > 0 ? outUsd / inUsd : undefined;
}

/** Above this cost we warn; above HIGH_COST we make the user tick a box before reviewing. */
export const WARN_COST = 0.03;
export const HIGH_COST = 0.08;

export function QuoteBox({
  quote,
  receive,
  minimum,
  retained,
  extra,
}: {
  quote: VaultQuote;
  receive: React.ReactNode;
  minimum: React.ReactNode;
  retained: number | undefined;
  extra?: React.ReactNode;
}) {
  if (quote.error) {
    return (
      <Callout variant="destructive" className="flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{quote.error}</span>
        <button
          type="button"
          onClick={() => void quote.refetch()}
          className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
        >
          <RefreshCwIcon className="size-3" /> Retry
        </button>
      </Callout>
    );
  }
  const cost = retained !== undefined ? 1 - retained : undefined;
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border bg-secondary/60 p-4', quote.isStale && 'opacity-60')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You receive</span>
        {quote.isLoading ? (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className="flex items-center gap-1 text-xs text-subtle-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-success" /> live
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-bold">
        {quote.amountOut !== undefined ? receive : <Skeleton className="h-8 w-40" />}
      </div>
      <InfoRow label="Minimum received" hint="If the solver can't deliver at least this, the intent is not filled.">
        {quote.minAmountOut !== undefined ? minimum : '–'}
      </InfoRow>
      {cost !== undefined && (
        <InfoRow
          label="Fees & routing"
          hint="Value in vs value out at SODAX money-market prices: protocol fee, solver spread and cross-chain routing."
        >
          <span className={cn(cost > HIGH_COST ? 'text-destructive' : cost > WARN_COST && 'text-accent-foreground')}>
            {cost <= 0 ? '≈ 0%' : `${(cost * 100).toFixed(2)}%`}
          </span>
        </InfoRow>
      )}
      {extra}
    </div>
  );
}
