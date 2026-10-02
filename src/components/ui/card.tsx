import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('win-window bg-card text-card-foreground', className)} {...props} />;
}

/** Windows 95-style title bar, flush with the top of a Card. Decorative controls are hidden from screen readers. */
export function CardTitleBar({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn('win-titlebar', className)}>
      <span className="truncate">{title}</span>
      <span className="flex shrink-0 gap-0.5" aria-hidden="true">
        <span className="win-control">_</span>
        <span className="win-control">□</span>
        <span className="win-control">×</span>
      </span>
    </div>
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('font-display text-sm leading-relaxed text-primary', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 p-6 pt-0', className)} {...props} />;
}
