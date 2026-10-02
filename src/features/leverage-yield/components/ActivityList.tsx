import { ArrowDownToLineIcon, ArrowUpFromLineIcon, ExternalLinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { explorerTxUrl } from '@/lib/chains';
import type { Activity } from '../hooks/useActivity';

const STATUS = {
  pending: { label: 'In progress', variant: 'muted' },
  filled: { label: 'Filled', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
} as const;

function ago(at: number): string {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function ActivityList({ items, onClear }: { items: Activity[]; onClear: () => void }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="activity" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="activity" className="font-display text-2xl font-bold">
          Recent activity
        </h2>
        <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {items.map(item => {
          const href = explorerTxUrl(item.chainKey, item.srcTxHash);
          const status = STATUS[item.status];
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                {item.kind === 'deposit' ? (
                  <ArrowDownToLineIcon className="size-4" />
                ) : (
                  <ArrowUpFromLineIcon className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {item.vaultName} · {ago(item.at)}
                </p>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View on explorer"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-4" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
