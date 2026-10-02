import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'hard-shadow border-2 border-primary-foreground bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'hard-shadow border-2 border-primary bg-secondary text-secondary-foreground hover:bg-muted',
        outline: 'hard-shadow border-2 border-primary bg-card text-primary hover:bg-secondary',
        ghost: 'text-foreground hover:bg-secondary',
        destructive:
          'hard-shadow border-2 border-primary-foreground bg-destructive text-destructive-foreground hover:opacity-90',
        /** For use on the hero / primary surfaces. */
        accent: 'hard-shadow border-2 border-primary-foreground bg-accent text-accent-foreground hover:opacity-90',
        link: 'font-sans normal-case tracking-normal text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-[10px]',
        sm: 'h-9 px-4 text-[9px]',
        lg: 'h-12 px-6 text-xs',
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
