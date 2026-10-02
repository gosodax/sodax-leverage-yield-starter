import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Field } from './Field';

type Props = {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Token symbol shown as a chip on the right. */
  symbol: string;
  error?: string;
  disabled?: boolean;
  /** Extra control beside the chip, e.g. a Max button. */
  trailing?: ReactNode;
};

/** A large amount input with the token as a chip, so the number is the focus of the form. */
export function AmountField({ label, id, value, onChange, symbol, error, disabled, trailing }: Props) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          aria-invalid={!!error}
          className="h-16 rounded-xl pr-36 text-2xl font-semibold tabular-nums"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
          {trailing}
          {symbol && (
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
              {symbol}
            </span>
          )}
        </div>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </Field>
  );
}
