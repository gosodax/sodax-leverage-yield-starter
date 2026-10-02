import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import type { DetailedLeverageYieldStatus } from '@sodax/sdk';
import { SolverIntentStatusCode, type SpokeChainKey } from '@sodax/types';
import { REFETCH_MS } from '@/config/workshop';

export type IntentPhase = 'delivering' | 'filling' | 'filled' | 'failed' | 'unknown';

const BACKEND_PHASE: Record<string, IntentPhase> = {
  pending: 'delivering',
  relaying: 'delivering',
  relayed: 'filling',
  posting_execution: 'filling',
  posted_execution: 'filling',
  solved: 'filled',
  failed: 'failed',
};

const SOLVER_PHASE: Partial<Record<SolverIntentStatusCode, IntentPhase>> = {
  [SolverIntentStatusCode.NOT_FOUND]: 'delivering',
  [SolverIntentStatusCode.SOLVED]: 'filled',
  [SolverIntentStatusCode.FAILED]: 'failed',
};

function phaseOf(status: DetailedLeverageYieldStatus): IntentPhase {
  if (status.source === 'backend') {
    return status.data.abandonedAt ? 'failed' : (BACKEND_PHASE[status.data.status] ?? 'unknown');
  }
  return SOLVER_PHASE[status.data.status] ?? 'filling';
}

/** ~10 minutes at REFETCH_MS, so an unresolvable status doesn't poll forever. */
const MAX_POLLS = 60;

/**
 * Live phase of a vault swap from its source-chain tx. Polls at REFETCH_MS (not the hook's 3s default: a room
 * shares one IP) until filled or out of budget. A backend 'failed' doesn't stop polling: `vaultSwap` falls back
 * to the client-side relay and may still complete.
 */
export function useIntentStatus(srcChainKey: SpokeChainKey, srcTxHash: string | undefined) {
  const { data } = useLeverageYieldDetailedStatus({
    params: { srcChainKey, srcTxHash },
    queryOptions: {
      refetchInterval: query => {
        const result = query.state.data;
        if (result?.ok && phaseOf(result.value) === 'filled') return false;
        return query.state.dataUpdateCount + query.state.errorUpdateCount < MAX_POLLS ? REFETCH_MS : false;
      },
    },
  });
  if (!data?.ok) return { phase: 'unknown' as IntentPhase, fillTxHash: undefined as string | undefined };
  const status = data.value;
  return {
    phase: phaseOf(status),
    fillTxHash: (status.source === 'backend' ? status.data.result?.fillTxHash : status.data.fill_tx_hash) as
      | string
      | undefined,
  };
}
