import { DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS } from '@/config/workshop';
import { cn } from '@/lib/utils';

const OPTIONS = [50, DEFAULT_SLIPPAGE_BPS, 200, MAX_SLIPPAGE_BPS].filter(
  (v, i, all) => v <= MAX_SLIPPAGE_BPS && all.indexOf(v) === i,
);

/** Slippage tolerance in bps, capped at MAX_SLIPPAGE_BPS. */
export function SlippageControl({ value, onChange }: { value: number; onChange: (bps: number) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Max slippage</span>
      <div className="flex gap-1">
        {OPTIONS.map(bps => (
          <button
            key={bps}
            type="button"
            onClick={() => onChange(Math.min(bps, MAX_SLIPPAGE_BPS))}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              value === bps
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted',
            )}
          >
            {bps / 100}%
          </button>
        ))}
      </div>
    </div>
  );
}
