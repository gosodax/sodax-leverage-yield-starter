import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { ThinkingOrb } from './thinking-orb';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Amber CTA: the only filled button colour. */
        default: 'bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover',
        /** Quiet action on paper: white fill, stone border. */
        secondary: 'border border-border-strong bg-card text-foreground hover:bg-secondary',
        /** Ghost button from the spec: transparent with an espresso border. */
        outline: 'border border-foreground bg-transparent text-foreground hover:bg-card',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        /** For use on the hero / primary surfaces. */
        accent: 'bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover',
        link: 'text-foreground underline decoration-link decoration-2 underline-offset-4 hover:decoration-primary',
      },
      size: {
        default: 'h-10 px-4 text-base',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-5 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Work in flight: shows a thinking orb before the label and marks the button busy. */
    busy?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  busy = false,
  type,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && !asChild ? (
        <>
          <ThinkingOrb state="working" size={20} decorative />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
