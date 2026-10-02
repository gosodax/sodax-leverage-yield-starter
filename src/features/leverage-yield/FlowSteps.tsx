import { ChainKeys } from '@sodax/sdk';
import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import type { FlowState, StepState } from './useTrackedFlow';

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <CheckCircle2Icon className="size-5 text-success" />;
  if (state === 'failed') return <XCircleIcon className="size-5 text-destructive" />;
  if (state === 'active') return <Loader2Icon className="size-5 animate-spin text-primary" />;
  return <CircleIcon className="size-5 text-subtle-foreground" />;
}

function TxLink({ chainKey, hash }: { chainKey: Parameters<typeof explorerTxUrl>[0]; hash?: string }) {
  if (!hash) return null;
  const url = explorerTxUrl(chainKey, hash);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      View tx <ExternalLinkIcon className="size-3" />
    </a>
  );
}

/** The planned steps of a deposit or withdraw, each marked as it completes, with explorer links. */
export function FlowSteps({ flow, labels }: { flow: FlowState; labels: { sign: string; fill: string } }) {
  const steps = [
    { key: 'approve', label: 'Approve token (your wallet may ask twice)', step: flow.approve },
    { key: 'sign', label: labels.sign, step: flow.sign },
    {
      key: 'deliver',
      label: 'Deliver to Sonic',
      step: { ...flow.deliver, chainKey: ChainKeys.SONIC_MAINNET },
    },
    { key: 'fill', label: labels.fill, step: flow.fill },
  ].filter(s => s.step.state !== 'skipped');

  return (
    <ol className="flex flex-col gap-3">
      {steps.map(({ key, label, step }, i) => (
        <li key={key} className="flex items-center gap-3">
          <StepIcon state={step.state} />
          <span
            className={cn(
              'flex-1 text-sm',
              step.state === 'todo' ? 'text-muted-foreground' : 'text-foreground',
              step.state === 'active' && 'font-medium',
            )}
          >
            {i + 1}. {label}
          </span>
          {step.chainKey && <TxLink chainKey={step.chainKey} hash={step.hash} />}
        </li>
      ))}
    </ol>
  );
}
