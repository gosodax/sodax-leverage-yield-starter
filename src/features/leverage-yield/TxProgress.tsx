import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import type { SpokeChainKey } from '@sodax/types';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Callout } from '@/components/ui/callout';
import { explorerTxUrl } from '@/lib/chains';

const SOLVER_SOLVED = 3;

export type TrackState = 'pending' | 'done' | 'failed';

/** Reads the vault swap status from the source tx until a terminal state. */
export function useTrackedState(srcChainKey: SpokeChainKey | undefined, srcTxHash: string | undefined): TrackState {
  const { data } = useLeverageYieldDetailedStatus({ params: { srcChainKey, srcTxHash } });
  if (!data?.ok) return 'pending';
  const v = data.value;
  if (v.source === 'backend') {
    if (v.data.status === 'solved') return 'done';
    if (v.data.status === 'failed') return 'failed';
    return 'pending';
  }
  if (Number(v.data.status) === SOLVER_SOLVED) return 'done';
  return 'pending';
}

export type Step = {
  label: string;
  state: 'todo' | 'active' | 'done' | 'error';
  txHash?: string;
  chain?: SpokeChainKey;
};

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {steps.map(s => {
        const url = s.txHash && s.chain ? explorerTxUrl(s.chain, s.txHash) : undefined;
        return (
          <li key={s.label} className="flex items-center gap-2">
            {s.state === 'done' && <CheckCircle2 className="size-4 text-success" aria-hidden />}
            {s.state === 'active' && <Loader2 className="size-4 animate-spin text-primary" aria-hidden />}
            {s.state === 'error' && <XCircle className="size-4 text-destructive" aria-hidden />}
            {s.state === 'todo' && <span className="size-4 rounded-full border" aria-hidden />}
            <span className={s.state === 'todo' ? 'text-muted-foreground' : ''}>{s.label}</span>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                tx <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ErrorNote({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <Callout variant="destructive">{message}</Callout>;
}
