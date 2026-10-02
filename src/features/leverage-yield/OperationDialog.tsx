import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, Loader2Icon, XCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import { CheersBottle } from './CheersBottle';
import type { FlowStage, VaultFlow } from './useVaultFlow';

export type SummaryRow = { label: string; value: ReactNode; emphasis?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  summary: SummaryRow[];
  /** Risks and reminders shown before the user signs. */
  warnings: ReactNode;
  confirmLabel: string;
  flow: VaultFlow;
  onConfirm: () => void;
  /** Deposits may need an approval first; withdrawals never do. */
  hasApprovalStep: boolean;
  /** Short label for the hub-side delivery, e.g. "Shares delivered" / "Tokens delivered". */
  deliveredLabel: string;
};

type StepStatus = 'todo' | 'active' | 'done' | 'failed';

const ORDER: FlowStage[] = ['preparing', 'approving', 'signing', 'filling', 'done'];

function stepStatus(flow: VaultFlow['state'], step: 'preparing' | 'approving' | 'signing' | 'filling'): StepStatus {
  if (flow.stage === 'failed') {
    if (flow.failedAt === step) return 'failed';
    return ORDER.indexOf(step) < ORDER.indexOf(flow.failedAt ?? 'preparing') ? 'done' : 'todo';
  }
  if (flow.stage === 'done') return 'done';
  const current = ORDER.indexOf(flow.stage);
  const index = ORDER.indexOf(step);
  if (index < current) return 'done';
  return index === current ? 'active' : 'todo';
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle2Icon className="size-5 text-success" />;
  if (status === 'failed') return <XCircleIcon className="size-5 text-destructive" />;
  if (status === 'active') return <Loader2Icon className="size-5 animate-spin text-primary" />;
  return <CircleIcon className="size-5 text-subtle-foreground" />;
}

function Step({
  status,
  label,
  detail,
  link,
}: {
  status: StepStatus;
  label: string;
  detail?: string;
  link?: { href?: string; text: string };
}) {
  return (
    <li className="flex gap-3">
      <StepIcon status={status} />
      <div className="flex min-w-0 flex-col">
        <span className={cn('text-sm font-medium', status === 'todo' && 'text-muted-foreground')}>{label}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        {link?.href && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {link.text} <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </div>
    </li>
  );
}

/**
 * Confirm-then-track dialog shared by deposit and withdraw. First it shows what the user gets, the minimum they'll
 * accept and the risks; after Confirm it walks through each step with explorer links until the solver fills.
 */
export function OperationDialog({
  open,
  onOpenChange,
  title,
  description,
  summary,
  warnings,
  confirmLabel,
  flow,
  onConfirm,
  hasApprovalStep,
  deliveredLabel,
}: Props) {
  const { state } = flow;
  const confirming = state.stage === 'idle';
  const finished = state.stage === 'done' || state.stage === 'failed';
  const srcExplorer =
    state.srcChainKey && state.srcTxHash ? explorerTxUrl(state.srcChainKey, state.srcTxHash) : undefined;
  const approvalExplorer =
    state.srcChainKey && state.approvalHash ? explorerTxUrl(state.srcChainKey, state.approvalHash) : undefined;
  const dstExplorer = state.dstTxHash ? explorerTxUrl('sonic', state.dstTxHash) : undefined;

  const handleOpenChange = (next: boolean) => {
    // Don't let a stray click close the dialog while a wallet prompt is open.
    if (!next && flow.busy) return;
    if (!next && finished) flow.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirming
              ? title
              : state.stage === 'done'
                ? 'Done'
                : state.stage === 'failed'
                  ? 'Something went wrong'
                  : 'In progress'}
          </DialogTitle>
          <DialogDescription>
            {confirming ? description : 'Keep this window open until the solver fills your order.'}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <>
            <dl className="grid gap-2 rounded-md bg-muted p-4 text-sm">
              {summary.map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className={cn('text-right', row.emphasis && 'font-semibold')}>{row.value}</dd>
                </div>
              ))}
            </dl>
            {warnings}
            <Button size="lg" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-4">
              <Step status={stepStatus(state, 'preparing')} label="Prepare the order" />
              {hasApprovalStep &&
                (state.needsApproval || state.stage === 'preparing' || state.stage === 'approving') && (
                  <Step
                    status={stepStatus(state, 'approving')}
                    label="Approve the token"
                    detail="Confirm in your wallet"
                    link={{ href: approvalExplorer, text: 'View approval' }}
                  />
                )}
              <Step
                status={stepStatus(state, 'signing')}
                label={`Sign on ${state.srcChainKey ? chainName(state.srcChainKey) : 'your network'}`}
                detail={state.stage === 'signing' ? 'Confirm in your wallet' : undefined}
                link={{ href: srcExplorer, text: 'View transaction' }}
              />
              <Step
                status={stepStatus(state, 'filling')}
                label={state.stage === 'done' ? deliveredLabel : 'Delivering to Sonic, solver fills'}
                detail={state.stage === 'filling' ? 'Usually under 2 minutes' : undefined}
                link={{ href: dstExplorer, text: 'View on Sonic' }}
              />
            </ol>
            {state.stage === 'done' && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-success-muted p-4 text-center text-success">
                <CheersBottle />
                <p className="font-display text-2xl">Cheers! 🥂</p>
                <p className="text-sm font-semibold">{deliveredLabel}</p>
              </div>
            )}
            {state.error && <Callout variant="destructive">{state.error}</Callout>}
            {flow.statusError && state.stage === 'filling' && (
              <p className="text-xs text-muted-foreground">Status check is retrying: {flow.statusError}</p>
            )}
            {finished && (
              <Button
                variant={state.stage === 'done' ? 'default' : 'outline'}
                onClick={() => {
                  flow.reset();
                  if (state.stage === 'done') onOpenChange(false);
                }}
              >
                {state.stage === 'done' ? 'Close' : 'Back'}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
