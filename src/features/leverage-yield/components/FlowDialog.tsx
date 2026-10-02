import type { SpokeChainKey } from '@sodax/types';
import { CheckCircle2Icon, ShieldAlertIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { type IntentPhase, useIntentStatus } from '../hooks/useIntentStatus';
import type { FlowState } from '../hooks/useVaultFlow';
import { Stepper, type StepRow, type StepStatus } from './Stepper';

export type ReviewLine = { label: string; value: React.ReactNode; strong?: boolean };

const ORDER = ['idle', 'preparing', 'approving', 'signing', 'processing', 'done'] as const;

function rowsFor(
  kind: 'deposit' | 'withdraw',
  state: FlowState,
  phase: IntentPhase,
  chainKey: SpokeChainKey,
  fillTxHash: string | undefined,
): StepRow[] {
  const at = state.step === 'error' ? (state.failedStep ?? 'processing') : state.step;
  const idx = ORDER.indexOf(at as (typeof ORDER)[number]);
  const reached = (s: (typeof ORDER)[number]) => idx >= ORDER.indexOf(s);
  const filled = state.step === 'done' || phase === 'filled';
  const signed = reached('processing');
  const hub = chainKey === 'sonic';

  const approve: StepStatus =
    at === 'preparing' || at === 'approving'
      ? 'active'
      : reached('signing')
        ? state.needsApproval
          ? 'done'
          : 'skipped'
        : 'pending';
  const sign: StepStatus = at === 'signing' ? 'active' : signed ? 'done' : 'pending';
  const deliver: StepStatus = !signed ? 'pending' : filled || phase === 'filling' ? 'done' : 'active';
  const fill: StepStatus = filled ? 'done' : signed && phase === 'filling' ? 'active' : 'pending';

  const rows: StepRow[] = [];
  if (kind === 'deposit') {
    rows.push({
      key: 'approve',
      title: approve === 'skipped' ? 'Approval not needed' : 'Approve token',
      detail: approve === 'active' && at === 'preparing' ? 'Checking allowance…' : 'One-time spend permission',
      status: approve,
      href: state.approveTxHash ? explorerTxUrl(chainKey, state.approveTxHash) : undefined,
    });
  }
  rows.push(
    {
      key: 'sign',
      title: kind === 'deposit' ? 'Sign deposit intent' : 'Sign withdraw intent',
      detail: `In your wallet, on ${chainName(chainKey)}`,
      status: kind === 'withdraw' && at === 'preparing' ? 'active' : sign,
      href: state.srcTxHash ? explorerTxUrl(chainKey, state.srcTxHash) : undefined,
    },
    {
      key: 'deliver',
      title: hub ? 'Register on Sonic' : 'Deliver to Sonic',
      detail: hub ? 'Already on the hub' : 'Relayed cross-chain, usually under a minute',
      status: deliver,
    },
    {
      key: 'fill',
      title: kind === 'deposit' ? 'Solver mints your shares' : 'Solver pays out',
      detail: 'Independent solvers fill the intent',
      status: fill,
      href: fillTxHash ? explorerTxUrl('sonic', fillTxHash) : undefined,
    },
  );

  if (state.step === 'error') {
    const failedKey =
      at === 'preparing' || at === 'approving'
        ? kind === 'deposit'
          ? 'approve'
          : 'sign'
        : at === 'signing'
          ? 'sign'
          : phase === 'filling'
            ? 'fill'
            : 'deliver';
    for (const row of rows) if (row.key === failedKey) row.status = 'error';
  }
  return rows;
}

/**
 * Review → progress, in one dialog. The review shows exactly what the user receives, the minimum they accept and
 * the risks before anything is signed; the progress view tracks every step with explorer links.
 */
export function FlowDialog({
  open,
  onOpenChange,
  kind,
  title,
  chainKey,
  review,
  warning,
  state,
  onConfirm,
  onPhase,
  successText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'deposit' | 'withdraw';
  title: string;
  chainKey: SpokeChainKey;
  review: ReviewLine[];
  warning?: string;
  state: FlowState;
  onConfirm: () => void;
  onPhase?: (phase: 'filled' | 'failed') => void;
  successText: string;
}) {
  const { phase, fillTxHash } = useIntentStatus(chainKey, state.srcTxHash);
  const busy = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error';
  const filled = state.step === 'done' || phase === 'filled';

  const reported = useRef<string>(undefined);
  useEffect(() => {
    if (!state.srcTxHash || reported.current === state.srcTxHash) return;
    if (filled) {
      reported.current = state.srcTxHash;
      onPhase?.('filled');
    } else if (state.step === 'error' && phase === 'failed') {
      reported.current = state.srcTxHash;
      onPhase?.('failed');
    }
  }, [filled, phase, state.step, state.srcTxHash, onPhase]);

  return (
    <Dialog open={open} onOpenChange={next => (!busy || next ? onOpenChange(next) : undefined)}>
      <DialogContent
        onInteractOutside={event => busy && event.preventDefault()}
        onEscapeKeyDown={event => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{state.step === 'idle' ? `Review ${kind}` : filled ? 'All done' : title}</DialogTitle>
          <DialogDescription>
            {state.step === 'idle'
              ? 'Check the details. Nothing is sent until you confirm in your wallet.'
              : filled
                ? successText
                : 'Keep this open. Your wallet will ask you to sign.'}
          </DialogDescription>
        </DialogHeader>

        {state.step === 'idle' ? (
          <>
            <dl className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
              {review.map(line => (
                <div key={line.label} className="flex items-start justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className={line.strong ? 'text-right font-semibold' : 'text-right'}>{line.value}</dd>
                </div>
              ))}
            </dl>
            {warning && (
              <Callout variant="destructive" className="flex gap-2">
                <ShieldAlertIcon className="size-4 shrink-0" />
                {warning}
              </Callout>
            )}
            <Callout className="text-xs leading-relaxed">
              Real funds on mainnet. The vault is leveraged (health ~1.2): APR is variable and can turn negative, the
              share price can fall, and you exit only by withdrawing. Shares are held by your SODAX hub wallet on Sonic,
              not in your wallet app.
            </Callout>
            <Button size="lg" onClick={onConfirm}>
              Confirm {kind}
            </Button>
          </>
        ) : (
          <>
            <Stepper rows={rowsFor(kind, state, phase, chainKey, fillTxHash)} />
            {state.step === 'error' && <Callout variant="destructive">{state.error}</Callout>}
            {filled && (
              <Callout variant="success" className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4" /> {successText}
              </Callout>
            )}
            {!busy && (
              <Button variant={filled ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
                {filled ? 'Done' : 'Close'}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
