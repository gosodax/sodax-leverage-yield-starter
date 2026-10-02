import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

/** Simple tooltip: <Tooltip content="Explanation"><InfoIcon weight="duotone" /></Tooltip> */
export function Tooltip({
  content,
  children,
  className,
  ...props
}: { content: ReactNode; children: ReactNode } & ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className={cn(
            'motion-drop z-50 max-w-xs rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg',
            className,
          )}
          {...props}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
