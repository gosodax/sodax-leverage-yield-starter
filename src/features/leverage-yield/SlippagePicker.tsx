import { formatBps } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SLIPPAGE_OPTIONS_BPS } from './helpers';

/** Slippage tolerance as a segmented choice, capped at MAX_SLIPPAGE_BPS by SLIPPAGE_OPTIONS_BPS. */
export function SlippagePicker({ value, onChange }: { value: number; onChange: (bps: number) => void }) {
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">Slippage tolerance</legend>
      <span className="text-sm text-muted-foreground" aria-hidden>
        Slippage
      </span>
      <div className="flex gap-1 rounded-full border bg-muted p-1">
        {SLIPPAGE_OPTIONS_BPS.map(bps => (
          <button
            key={bps}
            type="button"
            aria-pressed={value === bps}
            onClick={() => onChange(bps)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === bps ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {formatBps(bps)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
