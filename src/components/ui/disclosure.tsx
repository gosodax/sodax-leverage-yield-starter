import { CaretDownIcon } from '@phosphor-icons/react';
import { AnimatePresence, m } from 'motion/react';
import { type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { SLOW } from './motion';

/** A small "Details" toggle whose content opens with a height animation. Closed by default. */
export function Disclosure({
  label = 'Details',
  children,
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <CaretDownIcon
          weight="duotone"
          className={cn('size-3.5 transition-transform duration-200 ease-out', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            style={{ overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SLOW}
          >
            <div className="pt-2">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
