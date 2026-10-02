import type { ReactNode } from 'react';

export function QuoteRows({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="flex flex-col text-sm">
      {rows.map(row => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b py-2">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className={row.strong ? 'font-display text-xl tabular-nums' : 'tabular-nums'}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
