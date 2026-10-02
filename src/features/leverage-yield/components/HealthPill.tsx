import { cn } from '@/lib/utils';
import type { HealthTone } from '../lib/tier';

/** The vault strategy's health factor as a small toned pill. Warning has no theme token, so it's amber inline. */
export function HealthPill({ health }: { health: { label: string; tone: HealthTone } }) {
  const warning = health.tone === 'warning';
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        health.tone === 'success' && 'bg-success-muted text-success',
        health.tone === 'destructive' && 'bg-destructive-muted text-destructive',
        health.tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
      style={warning ? { backgroundColor: 'rgba(245,182,72,0.14)', color: '#f5b648' } : undefined}
    >
      {health.label}
    </span>
  );
}
