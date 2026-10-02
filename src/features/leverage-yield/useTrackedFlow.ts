import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import type { SpokeChainKey } from '@sodax/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { REFETCH_MS } from '@/config/workshop';

export type StepState = 'todo' | 'active' | 'done' | 'failed' | 'skipped';

export type FlowState = {
  approve: { state: StepState; hash?: string; chainKey?: SpokeChainKey };
  sign: { state: StepState; hash?: string; chainKey?: SpokeChainKey };
  deliver: { state: StepState; hash?: string };
  fill: { state: StepState; hash?: string; chainKey?: SpokeChainKey };
  error?: string;
};

export const initialFlow = (needsApproval: boolean): FlowState => ({
  approve: { state: needsApproval ? 'todo' : 'skipped' },
  sign: { state: 'todo' },
  deliver: { state: 'todo' },
  fill: { state: 'todo' },
});

/** Give up waiting (with a clear message) after this long. Intents expire ~5 minutes after they are built. */
const TRACK_TIMEOUT_MS = 6 * 60_000;

/**
 * Follows a vault swap from its source tx to a terminal status and updates the flow's deliver / fill steps.
 * `fillChainKey` is where the fill lands: Sonic for a deposit, the output network for a withdraw.
 */
export function useTrackFill(
  flow: FlowState | undefined,
  setFlow: (update: (f: FlowState) => FlowState) => void,
  fillChainKey: SpokeChainKey,
) {
  const queryClient = useQueryClient();
  const srcChainKey = flow?.sign.chainKey;
  const srcTxHash = flow?.sign.state === 'done' ? flow.sign.hash : undefined;
  const tracking = !!srcTxHash && flow?.fill.state !== 'done' && flow?.fill.state !== 'failed';
  const [startedAt, setStartedAt] = useState<number>();

  useEffect(() => {
    setStartedAt(srcTxHash ? Date.now() : undefined);
  }, [srcTxHash]);

  const { data: status } = useLeverageYieldDetailedStatus({
    params: { srcChainKey: tracking ? srcChainKey : undefined, srcTxHash: tracking ? srcTxHash : undefined },
    queryOptions: { refetchInterval: tracking ? REFETCH_MS : false },
  });

  useEffect(() => {
    if (!tracking) return;
    if (!status?.ok) {
      if (startedAt && Date.now() - startedAt > TRACK_TIMEOUT_MS) {
        setFlow(f => ({
          ...f,
          fill: { ...f.fill, state: 'failed' },
          error:
            'Still not filled after 6 minutes. The intent has likely expired; check your position on the hosted solution before retrying.',
        }));
      }
      return;
    }
    const value = status.value;
    let filled = false;
    let failed = false;
    let fillHash: string | undefined;
    let delivered = false;
    let deliverHash: string | undefined;
    let message: string | undefined;
    if (value.source === 'backend') {
      const d = value.data;
      filled = d.status === 'solved';
      failed = d.status === 'failed';
      fillHash = d.result?.fillTxHash;
      deliverHash = d.result?.dstIntentTxHash;
      delivered = ['relayed', 'posting_execution', 'posted_execution', 'solved'].includes(d.status);
      message = d.userMessage ?? d.failureReason;
    } else {
      filled = value.data.status === 3;
      failed = value.data.status === 4;
      fillHash = value.data.fill_tx_hash;
      deliverHash = value.dstTxHash;
      delivered = true;
    }
    setFlow(f => ({
      ...f,
      deliver: {
        state: delivered || filled ? 'done' : 'active',
        hash: deliverHash ?? f.deliver.hash,
      },
      fill: {
        ...f.fill,
        chainKey: fillChainKey,
        state: filled ? 'done' : failed ? 'failed' : delivered ? 'active' : 'todo',
        hash: fillHash ?? f.fill.hash,
      },
      error: failed ? (message ?? 'The intent was not filled. Your funds were not swapped.') : f.error,
    }));
    if (filled) {
      void queryClient.invalidateQueries({ queryKey: ['leverageYield'] });
      void queryClient.invalidateQueries({ queryKey: ['shared', 'xBalances'] });
    }
  }, [status, tracking, startedAt, setFlow, fillChainKey, queryClient]);
}
