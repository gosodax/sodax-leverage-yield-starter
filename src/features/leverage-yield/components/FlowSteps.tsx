import type { SpokeChainKey } from '@sodax/types';
import { ChainKeys } from '@sodax/types';
import { CheckIcon, ExternalLinkIcon, LoaderIcon, XIcon } from 'lucide-react';
import { explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import { useIntentStatus } from '../hooks/useIntentStatus';
import type { FlowState } from '../hooks/useVaultFlow';

type StepState = 'todo' | 'active' | 'done' | 'failed';
type Step = { label: string; state: StepState; tx?: { chainKey: SpokeChainKey; hash: string } };

/** Approve → sign → deliver to Sonic → solver fill, each with its explorer link once there is one. */
export function FlowSteps({
  flow,
  srcChainKey,
  withApprove,
}: {
  flow: FlowState;
  srcChainKey: SpokeChainKey;
  withApprove: boolean;
}) {
  const intent = useIntentStatus(srcChainKey, flow.srcTxHash);
  const failed = flow.status === 'error';
  const done = flow.status === 'done' || intent.phase === 'filled';
  const hubDirect = srcChainKey === ChainKeys.SONIC_MAINNET;

  const at = (active: boolean, complete: boolean): StepState =>
    complete ? 'done' : active ? (failed ? 'failed' : 'active') : 'todo';

  const signed = flow.srcTxHash !== undefined;
  const delivered = done || intent.phase === 'filling';
  const steps: Step[] = [];
  if (withApprove || flow.approveTxHash) {
    steps.push({
      label: 'Approve token',
      state: at(flow.step === 'approve', flow.step !== 'approve' && flow.status !== 'idle'),
      tx: flow.approveTxHash ? { chainKey: srcChainKey, hash: flow.approveTxHash } : undefined,
    });
  }
  steps.push({
    label: 'Sign in wallet',
    state: at(flow.step === 'sign', signed),
    tx: flow.srcTxHash ? { chainKey: srcChainKey, hash: flow.srcTxHash } : undefined,
  });
  if (!hubDirect) steps.push({ label: 'Deliver to Sonic', state: at(signed && !delivered, delivered) });
  steps.push({
    label: 'Solver fills',
    state: at(signed && (hubDirect || delivered) && !done, done),
    tx: intent.fillTxHash ? { chainKey: ChainKeys.SONIC_MAINNET, hash: intent.fillTxHash } : undefined,
  });

  return (
    <ol className="flex flex-col border-t border-foreground">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-3 border-b py-2.5 text-sm">
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center font-display text-xs',
              step.state === 'done' && 'bg-foreground text-background',
              step.state === 'active' && 'bg-accent text-accent-foreground',
              step.state === 'failed' && 'bg-destructive text-destructive-foreground',
              step.state === 'todo' && 'border text-subtle-foreground',
            )}
          >
            {step.state === 'done' ? (
              <CheckIcon className="size-3.5" />
            ) : step.state === 'active' ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : step.state === 'failed' ? (
              <XIcon className="size-3.5" />
            ) : (
              i + 1
            )}
          </span>
          <span className={cn('flex-1', step.state === 'todo' && 'text-subtle-foreground')}>{step.label}</span>
          {step.tx && <TxLink {...step.tx} />}
        </li>
      ))}
      {intent.message && !done && <li className="py-2 text-xs text-muted-foreground">{intent.message}</li>}
    </ol>
  );
}

export function TxLink({ chainKey, hash }: { chainKey: SpokeChainKey; hash: string }) {
  const url = explorerTxUrl(chainKey, hash);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-accent"
    >
      {hash.slice(0, 6)}…{hash.slice(-4)}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}
