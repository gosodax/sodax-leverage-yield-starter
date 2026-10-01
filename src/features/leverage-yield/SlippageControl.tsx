import { useState } from 'react';
import { DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS } from '@/config/workshop';
import { formatBps } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRESETS = [50, 100, 200, MAX_SLIPPAGE_BPS].filter(
  (bps, i, all) => bps <= MAX_SLIPPAGE_BPS && all.indexOf(bps) === i,
);

export function useSlippage() {
  return useState(DEFAULT_SLIPPAGE_BPS);
}

/** Slippage presets, capped at MAX_SLIPPAGE_BPS. */
export function SlippageControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (bps: number) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex gap-1" aria-label="Slippage tolerance">
      {PRESETS.map(bps => (
        <button
          key={bps}
          type="button"
          aria-pressed={value === bps}
          disabled={disabled}
          onClick={() => onChange(Math.min(bps, MAX_SLIPPAGE_BPS))}
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors disabled:opacity-50',
            value === bps
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-muted',
          )}
        >
          {formatBps(bps)}
        </button>
      ))}
    </fieldset>
  );
}
