import { CheckIcon, ExternalLinkIcon, Loader2Icon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FillStatus } from './useFillStatus';

export type StepState = 'upcoming' | 'active' | 'done' | 'failed';

export type FlowStep = {
  label: string;
  detail?: string;
  state: StepState;
  /** Explorer link for the step's transaction, once there is one. */
  txUrl?: string;
};

/** The steps a deposit or withdraw goes through: shown before signing, then marked as each one completes. */
export function FlowSteps({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex items-start gap-3">
          {/* Rail to the next step; turns green once this step is done. */}
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'absolute top-8 -bottom-2.5 left-[13px] w-0.5 rounded-full transition-colors duration-500',
                step.state === 'done' ? 'bg-success' : 'bg-border',
              )}
            />
          )}
          <StepIcon state={step.state} index={index} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  step.state === 'upcoming' && 'text-muted-foreground',
                  step.state === 'active' && 'text-primary',
                )}
              >
                {step.label}
              </span>
              {step.txUrl && (
                <a
                  href={step.txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View transaction <ExternalLinkIcon className="size-3" />
                </a>
              )}
            </div>
            {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ state, index }: { state: StepState; index: number }) {
  const base = 'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold';
  if (state === 'done') {
    return (
      <span className={cn(base, 'ls-pop bg-success text-primary-foreground')}>
        <CheckIcon className="size-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className={cn(base, 'ls-pop bg-destructive-muted text-destructive')}>
        <XIcon className="size-4" />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className={cn(base, 'bg-secondary text-primary')}>
        <Loader2Icon className="size-4 animate-spin" />
      </span>
    );
  }
  return <span className={cn(base, 'border text-muted-foreground')}>{index + 1}</span>;
}

/** State of the "solver fills" step. A fill can be seen before delivery resolves, so it is checked first. */
export function fillStepState(waiting: boolean, fillState: FillStatus['state']): StepState {
  if (fillState === 'filled') return 'done';
  if (fillState === 'failed' || fillState === 'timeout') return 'failed';
  return waiting ? 'active' : 'upcoming';
}
