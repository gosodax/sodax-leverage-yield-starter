import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-[11px] uppercase tracking-wider font-medium',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        muted: 'bg-muted text-muted-foreground',
        success: 'bg-success-muted text-success',
        destructive: 'bg-destructive-muted text-destructive',
        outline: 'border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
