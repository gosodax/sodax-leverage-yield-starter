import { formatTokenAmount } from '@/lib/format';
import { Label } from './Pickers';

/** A big Billboard figure input with balance and Max. */
export function AmountField({
  label,
  value,
  onChange,
  symbol,
  balance,
  decimals,
  onMax,
  disabled,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  balance: bigint | undefined;
  decimals: number;
  onMax?: () => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t-[3px] border-foreground pt-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          Balance{' '}
          <span className="tabular-nums">{balance === undefined ? '—' : formatTokenAmount(balance, decimals)}</span>
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              disabled={disabled || !balance}
              className="ml-2 font-display uppercase tracking-wider text-accent hover:underline disabled:opacity-40"
            >
              Max
            </button>
          )}
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          aria-invalid={invalid}
          aria-label={label}
          className="w-full min-w-0 bg-transparent font-display text-4xl font-medium tabular-nums outline-none placeholder:text-border aria-[invalid=true]:text-destructive"
        />
        <span className="font-display text-xl text-muted-foreground">{symbol}</span>
      </div>
    </div>
  );
}
