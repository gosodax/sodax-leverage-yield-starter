import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence, m } from 'motion/react';
import type { ReactNode } from 'react';
import { FAST } from '@/components/ui/motion';
import { ThinkingOrb } from '@/components/ui/thinking-orb';
import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export function Stepper({ steps }: { steps: { label: string; status: StepStatus; detail?: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps
        .filter(step => step.status !== 'skipped')
        .map(step => (
          <li key={step.label} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                step.status === 'done' && 'border-primary bg-primary text-primary-foreground',
                step.status === 'active' && 'border-primary bg-card',
                step.status === 'error' && 'border-destructive bg-destructive text-destructive-foreground',
                (step.status === 'pending' || step.status === 'skipped') && 'text-subtle-foreground',
              )}
            >
              {/* Orb, check or cross crossfade as the step moves from active to done (or failed). */}
              <AnimatePresence initial={false} mode="popLayout">
                <m.span
                  key={step.status}
                  className="flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={FAST}
                >
                  {step.status === 'done' && <CheckIcon weight="duotone" className="size-3.5" />}
                  {step.status === 'active' && <ThinkingOrb state="connecting" size={20} decorative />}
                  {step.status === 'error' && <XIcon weight="duotone" className="size-3.5" />}
                </m.span>
              </AnimatePresence>
            </span>
            <div className="flex flex-col">
              <span
                className={cn(
                  'text-sm',
                  step.status === 'active' && 'font-semibold',
                  (step.status === 'pending' || step.status === 'skipped') && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              {/* Explorer links slide in when the transaction hash arrives. */}
              <AnimatePresence initial={false}>
                {step.detail && (
                  <m.span
                    className="text-xs text-muted-foreground"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {step.detail}
                  </m.span>
                )}
              </AnimatePresence>
            </div>
          </li>
        ))}
    </ol>
  );
}
