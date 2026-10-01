import { useLeverageYieldDetailedStatus } from '@sodax/dapp-kit';
import { SolverIntentStatusCode, type SpokeChainKey } from '@sodax/types';

export type FillPhase = 'filling' | 'solved' | 'failed';

export type VaultSwapStatus = {
  phase: FillPhase;
  /** Hub (Sonic) tx where the intent landed, once known. */
  hubTxHash?: string;
  /** Hub (Sonic) tx where a solver filled the intent. */
  fillTxHash?: string;
  failureReason?: string;
};

/**
 * Tracks a vault deposit / withdraw from its source-chain tx until it fills. Routes to whichever source can answer
 * (the leverage-yield backend, or the solver if the client-side relay finished it). Polls every 3s until terminal.
 */
export function useVaultSwapStatus(srcChainKey: SpokeChainKey | undefined, srcTxHash: string | undefined) {
  const { data } = useLeverageYieldDetailedStatus({ params: { srcChainKey, srcTxHash } });

  if (!srcTxHash || !data?.ok) return { phase: 'filling' } satisfies VaultSwapStatus;

  const status = data.value;
  if (status.source === 'backend') {
    const s = status.data.status;
    return {
      phase: s === 'solved' ? 'solved' : s === 'failed' ? 'failed' : 'filling',
      failureReason: status.data.failureReason,
    } satisfies VaultSwapStatus;
  }

  const code = status.data.status;
  return {
    phase:
      code === SolverIntentStatusCode.SOLVED ? 'solved' : code === SolverIntentStatusCode.FAILED ? 'failed' : 'filling',
    hubTxHash: status.dstTxHash,
    fillTxHash: status.data.fill_tx_hash,
  } satisfies VaultSwapStatus;
}
