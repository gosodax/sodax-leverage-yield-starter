import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Re-renders its children with a short green or red flash whenever `value` changes, like a price tick.
 * No flash on first render.
 */
export function FlashValue({
  value,
  children,
  className,
}: {
  value: bigint | undefined;
  children: ReactNode;
  className?: string;
}) {
  // Tracks the previous value in state (React's "adjust state while rendering" pattern), not in an effect.
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down'>();
  if (value !== previous) {
    setPrevious(value);
    if (value !== undefined && previous !== undefined) setDirection(value > previous ? 'up' : 'down');
  }
  return (
    // A new key remounts the span, which restarts the CSS animation.
    <span
      key={value?.toString() ?? 'none'}
      className={cn(direction === 'up' && 'ls-flash-up', direction === 'down' && 'ls-flash-down', className)}
    >
      {children}
    </span>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts from 0 up to `target` over `durationMs` (ease-out). Display only. */
export function useCountUp(target: number | undefined, durationMs = 900): number | undefined {
  const [shown, setShown] = useState(target === undefined ? undefined : 0);
  useEffect(() => {
    if (target === undefined || prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return shown;
}

// Fixed positions so the burst looks the same every time; two red candles keep it reading as a chart.
const CANDLES = [
  { left: 6, height: 26, delay: 0, red: false },
  { left: 14, height: 40, delay: 180, red: false },
  { left: 22, height: 18, delay: 90, red: true },
  { left: 31, height: 46, delay: 260, red: false },
  { left: 40, height: 30, delay: 40, red: false },
  { left: 58, height: 52, delay: 140, red: false },
  { left: 67, height: 22, delay: 300, red: true },
  { left: 75, height: 44, delay: 60, red: false },
  { left: 84, height: 34, delay: 220, red: false },
  { left: 92, height: 50, delay: 120, red: false },
];

export type SuccessAmount = { value: number; unit: string };

/** The moment a vault swap fills: a drawn check, a pulse and rising candles behind the headline. */
export function SuccessBurst({
  title,
  amount,
  caption,
}: {
  title: string;
  amount?: SuccessAmount;
  caption?: ReactNode;
}) {
  const shown = useCountUp(amount?.value);
  return (
    <div
      role="status"
      className="ls-rise relative overflow-hidden rounded-lg border border-success/30 bg-success-muted px-5 pt-6 pb-5 text-center"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {CANDLES.map(candle => (
          <span
            key={candle.left}
            className={cn('ls-candle absolute bottom-0 w-1.5 rounded-sm', candle.red ? 'bg-destructive' : 'bg-success')}
            style={
              {
                left: `${candle.left}%`,
                height: candle.height,
                '--ls-delay': `${candle.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative mx-auto mb-3 size-14">
        <span aria-hidden className="ls-pulse absolute inset-0 rounded-full bg-success/30" />
        <svg viewBox="0 0 52 52" className="relative size-14 text-success" aria-hidden>
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="ls-check-ring" />
          <path
            d="M15 27l7 7 15-16"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ls-check-tick"
          />
        </svg>
      </div>
      <p className="relative font-display text-2xl">{title}</p>
      {amount && shown !== undefined && (
        <p className="relative mt-1 font-mono text-2xl font-semibold text-success tabular-nums">
          {shown.toLocaleString('en-US', { maximumFractionDigits: 4 })} {amount.unit}
        </p>
      )}
      {caption && <p className="relative mt-1 text-sm text-muted-foreground">{caption}</p>}
    </div>
  );
}
