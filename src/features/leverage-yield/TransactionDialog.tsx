import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type StepStatus = 'pending' | 'active' | 'done' | 'error';
type StepLink = { label: string; url: string };
export type TxStep = { id: string; label: string; status: StepStatus; links: StepLink[] };

export function useTxSteps(labels: Record<string, string>) {
  const initial = Object.entries(labels).map(([id, label]) => ({ id, label, status: 'pending' as const, links: [] }));
  const [steps, setSteps] = useState<TxStep[]>(initial);

  const update = useCallback(
    (id: string, status: StepStatus, links: StepLink[] = []) =>
      setSteps(current =>
        current.map(step => (step.id === id ? { ...step, status, links: [...step.links, ...links] } : step)),
      ),
    [],
  );
  const reset = useCallback(
    () => setSteps(Object.entries(labels).map(([id, label]) => ({ id, label, status: 'pending', links: [] }))),
    [labels],
  );

  return { steps, update, reset };
}

const STEP_ICON = {
  pending: <CircleIcon className="size-4 text-subtle-foreground" />,
  active: <Loader2Icon className="size-4 animate-spin text-primary" />,
  done: <CheckCircle2Icon className="size-4 text-success" />,
  error: <XCircleIcon className="size-4 text-destructive" />,
};

export type TxPhase = 'review' | 'running' | 'done' | 'failed';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  rows: { label: string; value: string }[];
  steps: TxStep[];
  phase: TxPhase;
  error?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function TransactionDialog({
  open,
  onOpenChange,
  title,
  rows,
  steps,
  phase,
  error,
  confirmLabel,
  onConfirm,
}: Props) {
  const busy = phase === 'running';
  return (
    <Dialog open={open} onOpenChange={next => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Review what you will sign. Real funds, mainnet.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-4 text-sm">
          {rows.map(row => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>

        {phase === 'review' ? (
          <Callout>
            The position is leveraged (health factor around 1.2). The APR is variable and can go negative, and the share
            price can fall.
          </Callout>
        ) : (
          <ol className="flex flex-col gap-3 text-sm">
            {steps.map(step => (
              <li key={step.id} className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  {STEP_ICON[step.status]}
                  {step.label}
                </span>
                {step.links.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-6 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {link.label}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                ))}
              </li>
            ))}
          </ol>
        )}

        {error ? <Callout variant="destructive">{error}</Callout> : null}
        {phase === 'done' ? <Callout variant="success">Done. Your position updates shortly.</Callout> : null}

        {phase === 'review' || phase === 'failed' ? (
          <Button onClick={onConfirm}>{phase === 'failed' ? 'Try again' : confirmLabel}</Button>
        ) : (
          <Button disabled={busy} variant="secondary" onClick={() => onOpenChange(false)}>
            {busy ? 'Waiting for confirmation…' : 'Close'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
