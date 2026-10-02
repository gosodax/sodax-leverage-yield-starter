import { type UseLeverageYieldDetailedStatusResult, useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import { SolverIntentStatusCode, type SpokeChainKey } from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { REFETCH_MS } from '@/config/workshop';

/** An intent expires 5 minutes after it is built; stop waiting a little after that. */
const TRACK_TIMEOUT_MS = 6 * 60_000;

/** The source-chain intent transaction a vault swap is followed from. */
export type TrackedTx = { srcChainKey: SpokeChainKey; srcTxHash: string };

export type FillStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'filled'; fillTxHash?: string }
  | { state: 'failed'; message: string }
  | { state: 'timeout' };

type Fill = { state: 'pending' } | { state: 'filled'; fillTxHash?: string } | { state: 'failed'; message: string };

function readFill(data: UseLeverageYieldDetailedStatusResult): Fill {
  // A miss (not delivered yet, or a dependency failing) is still in flight.
  if (!data?.ok) return { state: 'pending' };
  const status = data.value;
  if (status.source === 'backend') {
    if (status.data.status === 'solved') return { state: 'filled', fillTxHash: status.data.result?.fillTxHash };
    if (status.data.status === 'failed') {
      return { state: 'failed', message: status.data.userMessage ?? status.data.failureReason ?? 'The intent failed.' };
    }
    return { state: 'pending' };
  }
  if (status.data.status === SolverIntentStatusCode.SOLVED) {
    return { state: 'filled', fillTxHash: status.data.fill_tx_hash };
  }
  if (status.data.status === SolverIntentStatusCode.FAILED) {
    return { state: 'failed', message: 'No solver filled the intent before it expired.' };
  }
  return { state: 'pending' };
}

/**
 * Follows a vault swap from its source transaction to a terminal state. `vaultSwap` can resolve before the fill,
 * so this keeps polling until the solver fills or fails, or our own timeout passes.
 */
export function useFillStatus(tx: TrackedTx | undefined): FillStatus {
  const queryClient = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);

  const srcTxHash = tx?.srcTxHash;
  useEffect(() => {
    setTimedOut(false);
    if (!srcTxHash) return;
    const timer = setTimeout(() => setTimedOut(true), TRACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [srcTxHash]);

  const { data } = useLeverageYieldDetailedStatus({
    params: { srcChainKey: tx?.srcChainKey, srcTxHash },
    queryOptions: {
      // The default is 3s; keep to the workshop floor, and stop on a terminal state or our own timeout.
      refetchInterval: query => (!timedOut && readFill(query.state.data).state === 'pending' ? REFETCH_MS : false),
    },
  });

  const fill = readFill(data);

  useEffect(() => {
    if (fill.state === 'filled') {
      void queryClient.invalidateQueries({ queryKey: ['leverageYield', 'shareBalance'] });
    }
  }, [fill.state, queryClient]);

  if (!tx) return { state: 'idle' };
  if (fill.state === 'pending' && timedOut) return { state: 'timeout' };
  return fill;
}
