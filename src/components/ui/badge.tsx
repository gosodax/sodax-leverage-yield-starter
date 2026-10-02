import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-accent text-accent-foreground',
      muted: 'bg-muted text-muted-foreground',
      success: 'bg-success-muted text-foreground',
      destructive: 'bg-destructive-muted text-foreground',
      outline: 'border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
