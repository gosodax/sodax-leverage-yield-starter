import { ArrowDownIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SlippagePicker } from './SlippagePicker';

type Props = {
  /** What the user receives, e.g. "≈ 4.54 lsodaSUSDS". */
  receiveText: string;
  minText: string;
  loading: boolean;
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
};

/** The live quote: what you get as the headline, the minimum you'll accept, and the slippage control. */
export function QuoteSummary({ receiveText, minText, loading, slippageBps, onSlippageChange }: Props) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border bg-muted/50 p-4" aria-live="polite">
      <span className="absolute -top-4 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
        <ArrowDownIcon className="size-4" />
      </span>
      <div className="flex flex-col gap-0.5 pt-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">You receive</span>
        {loading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{receiveText}</span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Minimum you'll accept</span>
        <span className="text-right font-medium tabular-nums">{loading ? '–' : minText}</span>
      </div>
      <SlippagePicker value={slippageBps} onChange={onSlippageChange} />
    </div>
  );
}
