import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import type { DetailedLeverageYieldStatus } from '@sodax/sdk';
import { SolverIntentStatusCode, type SpokeChainKey } from '@sodax/types';
import { REFETCH_MS } from '@/config/workshop';

export type IntentPhase = 'relaying' | 'filling' | 'filled' | 'failed' | 'unknown';

const BACKEND: Record<string, IntentPhase> = {
  pending: 'relaying',
  relaying: 'relaying',
  relayed: 'filling',
  posting_execution: 'filling',
  posted_execution: 'filling',
  solved: 'filled',
  failed: 'failed',
};

function phaseOf(status: DetailedLeverageYieldStatus): IntentPhase {
  if (status.source === 'backend')
    return status.data.abandonedAt ? 'failed' : (BACKEND[status.data.status] ?? 'unknown');
  if (status.data.status === SolverIntentStatusCode.NOT_FOUND) return 'relaying';
  if (status.data.status === SolverIntentStatusCode.SOLVED) return 'filled';
  if (status.data.status === SolverIntentStatusCode.FAILED) return 'failed';
  return 'filling';
}

/** About ten minutes at REFETCH_MS, so an unresolvable status doesn't poll forever. */
const MAX_POLLS = 60;

/** Live status of a vault swap, from the tx the user signed on the source chain. */
export function useIntentStatus(srcChainKey: SpokeChainKey, srcTxHash: string | undefined) {
  const { data } = useLeverageYieldDetailedStatus({
    params: { srcChainKey, srcTxHash },
    queryOptions: {
      refetchInterval: query => {
        const result = query.state.data;
        const phase = result?.ok ? phaseOf(result.value) : 'unknown';
        if (phase === 'filled' || phase === 'failed') return false;
        return query.state.dataUpdateCount + query.state.errorUpdateCount < MAX_POLLS ? REFETCH_MS : false;
      },
    },
  });
  if (!data?.ok) return { phase: 'unknown' as IntentPhase, message: undefined, fillTxHash: undefined };
  const status = data.value;
  return {
    phase: phaseOf(status),
    message: status.source === 'backend' ? (status.data.userMessage ?? status.data.failureReason) : undefined,
    fillTxHash: status.source === 'backend' ? status.data.result?.fillTxHash : status.data.fill_tx_hash,
  };
}
