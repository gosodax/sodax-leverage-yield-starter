import { cn } from '@/lib/utils';

/** Big numeric input with quick-fill chips (25% / 50% / Max …). */
export function AmountInput({
  value,
  onChange,
  suffix,
  usd,
  invalid,
  chips,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  suffix: React.ReactNode;
  usd?: string;
  invalid?: boolean;
  chips?: { label: string; onClick: () => void; disabled?: boolean }[];
  ariaLabel: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border bg-card p-3 focus-within:ring-2 focus-within:ring-ring',
        invalid && 'border-destructive focus-within:ring-destructive',
      )}
    >
      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          aria-label={ariaLabel}
          aria-invalid={invalid}
          value={value}
          onChange={event => {
            const next = event.target.value.replace(',', '.');
            if (/^\d*\.?\d*$/.test(next)) onChange(next);
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold outline-none placeholder:text-subtle-foreground"
        />
        <div className="shrink-0">{suffix}</div>
      </div>
      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{usd}</span>
        {chips && (
          <div className="flex gap-1">
            {chips.map(chip => (
              <button
                key={chip.label}
                type="button"
                disabled={chip.disabled}
                onClick={chip.onClick}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
