import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const calloutVariants = cva('rounded-md border border-l-4 p-4 text-sm', {
  variants: {
    variant: {
      /** Neutral notice, e.g. the real funds warning. */
      notice: 'border-primary bg-notice text-foreground',
      destructive: 'border-destructive bg-destructive-muted text-foreground',
      success: 'border-primary bg-success-muted text-foreground',
    },
  },
  defaultVariants: { variant: 'notice' },
});

export function Callout({
  className,
  variant,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof calloutVariants>) {
  return <div role="note" className={cn(calloutVariants({ variant }), className)} {...props} />;
}
