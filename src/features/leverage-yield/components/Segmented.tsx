import { cn } from '@/lib/utils';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'default',
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: 'default' | 'sm';
  className?: string;
}) {
  return (
    <fieldset className={cn('flex w-fit gap-1 rounded-full border bg-muted p-1', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-1.5 text-sm',
            value === option.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
