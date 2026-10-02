import { CheckIcon, ExternalLinkIcon, Loader2Icon, MinusIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export type StepRow = { key: string; title: string; detail?: string; status: StepStatus; href?: string };

export function Stepper({ rows }: { rows: StepRow[] }) {
  return (
    <ol className="flex flex-col">
      {rows.map((row, i) => (
        <li key={row.key} className="relative flex gap-3 pb-5 last:pb-0">
          {i < rows.length - 1 && (
            <span
              className={cn(
                'absolute top-8 left-[13px] h-[calc(100%-2rem)] w-0.5',
                row.status === 'done' || row.status === 'skipped' ? 'bg-success' : 'bg-border',
              )}
            />
          )}
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
              row.status === 'done' && 'border-success bg-success text-primary-foreground',
              row.status === 'skipped' && 'border-success bg-success-muted text-success',
              row.status === 'active' && 'border-primary bg-card text-primary',
              row.status === 'pending' && 'border-border bg-card text-subtle-foreground',
              row.status === 'error' && 'border-destructive bg-destructive text-destructive-foreground',
            )}
          >
            {row.status === 'done' ? (
              <CheckIcon className="size-4" />
            ) : row.status === 'skipped' ? (
              <MinusIcon className="size-4" />
            ) : row.status === 'active' ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : row.status === 'error' ? (
              <XIcon className="size-4" />
            ) : (
              i + 1
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col pt-0.5">
            <span className={cn('text-sm font-semibold', row.status === 'pending' && 'text-muted-foreground')}>
              {row.title}
            </span>
            {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
            {row.href && (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View transaction <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
