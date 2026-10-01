import { CheckIcon, ExternalLinkIcon, Loader2Icon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped';

export type Step = {
  label: string;
  state: StepState;
  detail?: string;
  link?: { href: string; label: string };
};

function StepIcon({ state }: { state: StepState }) {
  const base = 'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs';
  if (state === 'done' || state === 'skipped')
    return (
      <span className={cn(base, 'border-success bg-success-muted text-success')}>
        <CheckIcon className="size-3.5" />
      </span>
    );
  if (state === 'active')
    return (
      <span className={cn(base, 'border-primary text-primary')}>
        <Loader2Icon className="size-3.5 animate-spin" />
      </span>
    );
  if (state === 'error')
    return (
      <span className={cn(base, 'border-destructive bg-destructive-muted text-destructive')}>
        <XIcon className="size-3.5" />
      </span>
    );
  return <span className={cn(base, 'border-border bg-muted')} />;
}

/** Vertical progress list for a multi-step transaction (approve → sign → fill). */
export function TxSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map(step => (
        <li key={step.label} className="flex items-start gap-3">
          <StepIcon state={step.state} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
            <span
              className={cn(
                'text-sm font-medium',
                step.state === 'pending' && 'text-muted-foreground',
                step.state === 'error' && 'text-destructive',
              )}
            >
              {step.label}
              {step.state === 'skipped' && <span className="font-normal text-muted-foreground"> · not needed</span>}
            </span>
            {step.detail && <span className="text-xs text-muted-foreground">{step.detail}</span>}
            {step.link && (
              <a
                href={step.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {step.link.label}
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
