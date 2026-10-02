import { ChainKeys, type SpokeChainKey } from '@sodax/types';
import { CheckIcon, ExternalLinkIcon, Loader2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import type { FlowPhase, FlowState } from '../hooks/useVaultFlow';

type StepStatus = 'pending' | 'active' | 'done' | 'failed';
type Step = { phase: FlowPhase; label: string; status: StepStatus; tx?: { chainKey: SpokeChainKey; hash: string } };

const ORDER: FlowPhase[] = ['preparing', 'approving', 'signing', 'relaying', 'filling', 'done'];

function statusOf(step: FlowPhase, state: FlowState): StepStatus {
  const current = state.phase === 'failed' ? (state.failedAt ?? 'preparing') : state.phase;
  const stepIndex = ORDER.indexOf(step);
  const currentIndex = ORDER.indexOf(current);
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return state.phase === 'failed' ? 'failed' : 'active';
  return 'pending';
}

export function FlowProgress({
  state,
  kind,
  fillLabel,
  skipsRelay,
  onReset,
}: {
  state: FlowState;
  kind: 'deposit' | 'withdraw' | 'swap';
  fillLabel: string;
  skipsRelay: boolean;
  onReset: () => void;
}) {
  const src = state.srcChainKey;
  const steps: Step[] = [];
  if (state.approvalNeeded) {
    steps.push({
      phase: 'approving',
      label: 'Approve token',
      status: statusOf('approving', state),
      tx: src && state.approveTxHash ? { chainKey: src, hash: state.approveTxHash } : undefined,
    });
  }
  steps.push({
    phase: 'signing',
    label: `Sign ${kind === 'withdraw' ? 'withdrawal' : kind} in your wallet`,
    status: state.phase === 'preparing' ? 'pending' : statusOf('signing', state),
    tx: src && state.srcTxHash ? { chainKey: src, hash: state.srcTxHash } : undefined,
  });
  if (!skipsRelay) {
    steps.push({ phase: 'relaying', label: 'Deliver to Sonic', status: statusOf('relaying', state) });
  }
  steps.push({
    phase: 'filling',
    label: fillLabel,
    status: statusOf('filling', state),
    tx: state.fillTxHash ? { chainKey: ChainKeys.SONIC_MAINNET, hash: state.fillTxHash } : undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {steps.map(step => (
          <li key={step.phase} className="flex items-center gap-3 text-sm">
            <StepIcon status={step.status} />
            <span
              className={cn(
                'flex-1',
                step.status === 'pending' && 'text-subtle-foreground',
                step.status === 'failed' && 'text-destructive',
              )}
            >
              {step.label}
            </span>
            {step.tx && <TxLink chainKey={step.tx.chainKey} hash={step.tx.hash} />}
          </li>
        ))}
      </ol>

      {state.phase === 'relaying' && (
        <p className="text-xs text-muted-foreground">
          Usually under 2 minutes. Keep this open; your transaction is already on-chain.
        </p>
      )}
      {state.phase === 'done' && (
        <Callout variant="success">
          {kind === 'deposit'
            ? 'Deposit complete. Your shares are in your SODAX hub wallet.'
            : kind === 'swap'
              ? 'Swap complete.'
              : 'Withdrawal complete.'}
        </Callout>
      )}
      {state.phase === 'failed' && state.error && <Callout variant="destructive">{state.error}</Callout>}
      {(state.phase === 'done' || state.phase === 'failed') && (
        <Button variant="outline" onClick={onReset}>
          {state.phase === 'done' ? 'Done' : 'Back to form'}
        </Button>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  const base = 'flex size-6 shrink-0 items-center justify-center rounded-full';
  if (status === 'done')
    return (
      <span className={cn(base, 'bg-success text-primary-foreground')}>
        <CheckIcon className="size-3.5" />
      </span>
    );
  if (status === 'active')
    return (
      <span className={cn(base, 'bg-secondary text-primary')}>
        <Loader2Icon className="size-3.5 animate-spin" />
      </span>
    );
  if (status === 'failed')
    return (
      <span className={cn(base, 'bg-destructive text-destructive-foreground')}>
        <XIcon className="size-3.5" />
      </span>
    );
  return <span className={cn(base, 'border border-border')} />;
}

function TxLink({ chainKey, hash }: { chainKey: SpokeChainKey; hash: string }) {
  const url = explorerTxUrl(chainKey, hash);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      View tx <ExternalLinkIcon className="size-3" />
    </a>
  );
}
