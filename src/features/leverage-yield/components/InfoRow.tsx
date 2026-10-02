import { InfoIcon } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function InfoRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 text-sm', className)}>
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <button type="button" aria-label={`About ${label}`} className="text-subtle-foreground">
              <InfoIcon className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
