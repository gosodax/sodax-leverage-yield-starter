import { InfoIcon } from '@phosphor-icons/react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A duotone Info icon that explains something on hover, keyboard focus or tap (Radix tooltips ignore taps, so a click
 * toggles it too). For background only: anything the user must read before signing belongs in the risk notice.
 */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={event => {
            event.preventDefault();
            setOpen(value => !value);
          }}
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-sm align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <InfoIcon weight="duotone" className="size-4" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          collisionPadding={16}
          onPointerDownOutside={() => setOpen(false)}
          className="motion-drop z-50 max-w-xs rounded-md border bg-card px-3 py-2 text-sm font-normal text-muted-foreground shadow-lg"
        >
          {children}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
