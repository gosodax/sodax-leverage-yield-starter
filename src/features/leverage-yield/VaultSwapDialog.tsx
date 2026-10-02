import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import { ChainKeys, SolverIntentStatusCode } from '@sodax/types';
import { AlertCircle, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { REFETCH_MS } from '@/config/workshop';
import { explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import type { StepState, useVaultSwapFlow, VaultSwapStep } from './useVaultSwapFlow';

type Flow = ReturnType<typeof useVaultSwapFlow>;

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <Check className="size-4 text-success" aria-label="done" />;
  if (state === 'active') return <Loader2 className="size-4 animate-spin text-primary" aria-label="in progress" />;
  if (state === 'failed') return <AlertCircle className="size-4 text-destructive" aria-label="failed" />;
  return <span className="block size-2 rounded-full bg-border" aria-hidden />;
}

function TxLink({ label, chainKey, txHash }: { label: string; chainKey: string; txHash: string }) {
  const url = explorerTxUrl(chainKey as Parameters<typeof explorerTxUrl>[0], txHash);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
    >
      {label} <ExternalLink className="size-3" />
    </a>
  );
}

/**
 * Progress dialog for one vault swap. Renders the flow's steps and, while the flow is in its
 * "filling" phase, polls `useLeverageYieldDetailedStatus` (at the workshop's REFETCH_MS floor)
 * until the backend or the solver reports a terminal status.
 */
export function VaultSwapDialog({
  flow,
  summary,
  approveLabel,
}: {
  flow: Flow;
  /** e.g. "Deposit 5 USDC from Base into lsodaSUSDS" */
  summary: string;
  /** e.g. "Approve USDC" */
  approveLabel: string;
}) {
  const { state, markSolved, markFailed, reset } = flow;
  const open = state.phase !== 'idle';
  const filling = state.phase === 'filling';

  const { data: status } = useLeverageYieldDetailedStatus({
    params: {
      srcChainKey: filling ? state.srcChainKey : undefined,
      srcTxHash: filling ? state.srcTxHash : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  useEffect(() => {
    if (!filling || !status?.ok) return;
    if (status.value.source === 'backend') {
      const backendStatus = status.value.data.status;
      if (backendStatus === 'solved') markSolved();
      else if (backendStatus === 'failed') {
        markFailed(status.value.data.failureReason ?? 'The vault swap failed to process.');
      }
    } else {
      const solverStatus = status.value.data.status;
      if (solverStatus === SolverIntentStatusCode.SOLVED) markSolved(status.value.dstTxHash);
      else if (solverStatus === SolverIntentStatusCode.FAILED) {
        markFailed('The solver could not fill this intent. Your funds were not taken.');
      }
    }
  }, [filling, status, markSolved, markFailed]);

  const isDeposit = state.action === 'deposit';
  const steps: { id: VaultSwapStep; label: string }[] = [
    { id: 'build', label: 'Build the intent' },
    ...(isDeposit ? [{ id: 'approve' as const, label: approveLabel }] : []),
    { id: 'submit', label: isDeposit ? 'Sign & submit the deposit' : 'Sign & submit the withdrawal' },
    { id: 'fill', label: 'Deliver to Sonic — a solver fills the order' },
  ];

  return (
    <Dialog open={open} onOpenChange={next => !next && reset()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDeposit ? 'Deposit' : 'Withdraw'}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-3">
          {steps.map(step => {
            const stepState = state.steps[step.id];
            return (
              <li key={step.id} className="flex items-center gap-3">
                <span className="flex size-5 items-center justify-center">
                  <StepIcon state={stepState} />
                </span>
                <span
                  className={cn(
                    'text-sm',
                    stepState === 'pending' && 'text-muted-foreground',
                    stepState === 'skipped' && 'text-muted-foreground line-through',
                    stepState === 'failed' && 'text-destructive',
                  )}
                >
                  {step.label}
                  {step.id === 'approve' && stepState === 'skipped' && ' (already approved)'}
                </span>
              </li>
            );
          })}
        </ol>

        {(state.approveTxHash || state.srcTxHash || state.dstTxHash) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
            {state.approveTxHash && state.srcChainKey && (
              <TxLink label="Approval" chainKey={state.srcChainKey} txHash={state.approveTxHash} />
            )}
            {state.srcTxHash && state.srcChainKey && (
              <TxLink label="Source transaction" chainKey={state.srcChainKey} txHash={state.srcTxHash} />
            )}
            {state.dstTxHash && (
              <TxLink label="Sonic transaction" chainKey={ChainKeys.SONIC_MAINNET} txHash={state.dstTxHash} />
            )}
          </div>
        )}

        {filling && (
          <p className="text-xs text-muted-foreground">
            Usually under 2 minutes. Your transaction is on-chain — it completes even if you close this dialog.
          </p>
        )}

        {state.phase === 'solved' && (
          <Callout variant="success">
            {isDeposit
              ? 'Deposit filled. Your vault shares are held by your SODAX hub wallet on Sonic — the "Your position" card shows them.'
              : 'Withdrawal filled. The tokens were delivered to your wallet on the destination network.'}
          </Callout>
        )}
        {state.phase === 'failed' && <Callout variant="destructive">{state.error}</Callout>}
        {state.phase === 'rejected' && <Callout>{state.error} No funds moved.</Callout>}

        {(state.phase === 'solved' || state.phase === 'failed' || state.phase === 'rejected') && (
          <Button onClick={reset} className="self-end">
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
