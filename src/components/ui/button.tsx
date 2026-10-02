import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.6),0_1px_1px_rgba(0,0,0,.25)] transition-colors active:shadow-[inset_0_1px_3px_rgba(0,0,0,.35)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-primary-hover bg-gradient-to-b from-primary-light to-primary text-primary-foreground hover:to-primary-hover',
        secondary:
          'border-border bg-gradient-to-b from-secondary-light to-secondary text-secondary-foreground font-semibold hover:to-muted',
        outline: 'border-input bg-card text-foreground shadow-none hover:bg-secondary',
        ghost: 'border-transparent text-foreground shadow-none hover:bg-secondary',
        destructive: 'border-destructive bg-destructive text-destructive-foreground hover:opacity-90',
        /** For use on the hero / primary surfaces. */
        accent: 'border-primary-hover bg-accent text-accent-foreground font-semibold hover:opacity-90',
        link: 'border-transparent text-primary underline-offset-4 shadow-none hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}

export { buttonVariants };
