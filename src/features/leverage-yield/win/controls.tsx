import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Btn({ className, isDefault, type, ...props }: ComponentProps<'button'> & { isDefault?: boolean }) {
  return (
    <button
      type={type ?? 'button'}
      data-default={isDefault ? 'true' : undefined}
      className={cn('w2k-btn', className)}
      {...props}
    />
  );
}

export function GroupBox({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn('w2k-group min-w-0', className)}>
      <legend className="w2k-group-label">{label}</legend>
      {children}
    </fieldset>
  );
}

export function ProgressBar({
  value,
  indeterminate,
  className,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cn('w2k-progress bevel-thin-in overflow-hidden bg-[var(--win-window)]', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
    >
      {indeterminate ? (
        <div className="w2k-progress-marquee" />
      ) : (
        <div className="w2k-progress-fill" style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('etched-h my-2', className)} />;
}

/** Label/value row in property sheets. */
export function Prop({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={hint}>
      <dt className="shrink-0 text-[var(--win-dark)]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-bold">{children}</dd>
    </div>
  );
}

export function ExtLink({
  href,
  children,
  className,
}: {
  href: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('w2k-link', className)}>
      {children}
    </a>
  );
}
