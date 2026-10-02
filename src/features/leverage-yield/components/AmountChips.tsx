import { animate, m } from 'motion/react';
import type { RefObject } from 'react';
import { formatUnits } from 'viem';
import { FAST } from '@/components/ui/motion';
import { Tooltip } from '@/components/ui/tooltip';
import { parseTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

const PERCENTS = [25n, 50n, 75n] as const;
const RATIO_SCALE = 10_000n;

/**
 * The amount each chip fills, in smallest units: 25%, 50%, 75% of `base`, and Max at `maxRatio` of it. Every chip is
 * also held at or below `cap` (a balance minus a gas reserve). Integer math only, so it rounds down and never fills
 * more than the balance.
 */
export function chipAmounts(base: bigint, cap: bigint, maxRatio: number): { label: string; amount: bigint }[] {
  const ceiling = cap < 0n ? 0n : cap < base ? cap : base;
  const clamp = (value: bigint) => (value > ceiling ? ceiling : value);
  const ratio = BigInt(Math.round(maxRatio * Number(RATIO_SCALE)));
  return [
    ...PERCENTS.map(percent => ({ label: `${percent}%`, amount: clamp((base * percent) / 100n) })),
    { label: 'Max', amount: clamp((base * ratio) / RATIO_SCALE) },
  ];
}

/**
 * Quick-fill chips under an amount input. A chip writes the amount as text, exactly as typing would (so the quote
 * debounce applies), and crossfades the input. The chip whose amount equals the input is highlighted.
 */
export function AmountChips({
  base,
  cap,
  maxRatio,
  decimals,
  value,
  onFill,
  disabledReason,
  inputRef,
}: {
  base: bigint | undefined;
  cap?: bigint;
  maxRatio: number;
  decimals: number;
  value: string;
  onFill: (text: string) => void;
  /** Why the chips can't be used (no wallet, no balance); greys them out with a tooltip. */
  disabledReason?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const disabled = !!disabledReason || !base;
  const chips = base ? chipAmounts(base, cap ?? base, maxRatio) : PERCENT_LABELS.map(label => ({ label, amount: 0n }));
  const current = parseTokenAmount(value, decimals);

  const fill = (amount: bigint) => {
    onFill(formatUnits(amount, decimals));
    if (inputRef?.current) animate(inputRef.current, { opacity: [0.4, 1] }, FAST);
  };

  const row = (
    <div className="flex gap-2">
      {chips.map(chip => {
        const active = !disabled && current !== undefined && chip.amount > 0n && current === chip.amount;
        return (
          <m.button
            key={chip.label}
            type="button"
            disabled={disabled || chip.amount === 0n}
            aria-pressed={active}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={FAST}
            onClick={() => fill(chip.amount)}
            className={cn(
              'rounded-sm border border-border-strong px-2 py-1 text-xs font-medium text-foreground transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              active ? 'bg-accent' : 'bg-transparent hover:bg-card',
            )}
          >
            {chip.label}
          </m.button>
        );
      })}
    </div>
  );

  if (!disabledReason) return row;
  return (
    <Tooltip content={disabledReason}>
      <span className="w-fit">
        {row}
        <span className="sr-only">{disabledReason}</span>
      </span>
    </Tooltip>
  );
}

const PERCENT_LABELS = ['25%', '50%', '75%', 'Max'];
