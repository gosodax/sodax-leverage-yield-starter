import {
  useLeverageYieldDetailedStatus,
  useLeverageYieldVaultSwap,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { LeverageYieldSwapPayload } from '@sodax/sdk';
import {
  ChainKeys,
  type IEvmWalletProvider,
  type Result,
  SolverIntentStatusCode,
  type SpokeChainKey,
} from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hash } from 'viem';
import { REFETCH_MS } from '@/config/workshop';
import { txErrorMessage } from '../lib/errors';
import { withTxListener } from '../lib/withTxListener';

export type FlowPhase = 'idle' | 'preparing' | 'approving' | 'signing' | 'relaying' | 'filling' | 'done' | 'failed';

export type FlowState = {
  phase: FlowPhase;
  srcChainKey?: SpokeChainKey;
  /** null = checked and not needed; undefined = not checked yet. */
  approvalNeeded?: boolean | null;
  approveTxHash?: string;
  srcTxHash?: string;
  fillTxHash?: string;
  /** The phase that failed, so the stepper can mark the right step. */
  failedAt?: FlowPhase;
  error?: string;
};

type RunArgs = {
  srcChainKey: SpokeChainKey;
  walletProvider: IEvmWalletProvider;
  /** Builds the vault-swap payload (deposit or withdraw builder from dapp-kit). */
  build: () => Promise<Result<LeverageYieldSwapPayload>>;
  /** Deposits spend a spoke token, so they may need an ERC-20 approval. Withdraws spend hub-wallet shares: never. */
  checkApproval: boolean;
};

const IDLE: FlowState = { phase: 'idle' };

/**
 * Runs a vault deposit or withdraw end to end: build → approve (if needed) → sign → relay to Sonic → solver fill,
 * tracking each step's tx hash for explorer links. Errors come back as `Result`s and are surfaced as copy, never
 * thrown.
 */
export function useVaultFlow() {
  const { sodax } = useSodaxContext();
  const queryClient = useQueryClient();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [state, setState] = useState<FlowState>(IDLE);
  const runId = useRef(0);

  const update = useCallback((id: number, patch: Partial<FlowState>) => {
    if (id === runId.current) setState(s => ({ ...s, ...patch }));
  }, []);

  const fail = useCallback(
    (id: number, failedAt: FlowPhase, error: unknown) => {
      const message = txErrorMessage(error);
      // A wallet rejection isn't a failure worth a red banner: go back to the form.
      if (message === undefined) update(id, { ...IDLE, phase: 'idle' });
      else update(id, { phase: 'failed', failedAt, error: message });
    },
    [update],
  );

  const run = useCallback(
    async ({ srcChainKey, walletProvider, build, checkApproval }: RunArgs) => {
      const id = ++runId.current;
      setState({ phase: 'preparing', srcChainKey });

      const built = await build();
      if (!built.ok) return fail(id, 'preparing', built.error);
      const payload = built.value;

      if (checkApproval) {
        const allowance = await sodax.swaps.isAllowanceValid({ params: payload.params, walletProvider, raw: false });
        if (!allowance.ok) return fail(id, 'preparing', allowance.error);
        if (!allowance.value) {
          update(id, { phase: 'approving', approvalNeeded: true });
          const approved = await approve({ params: payload.params, walletProvider });
          if (!approved.ok) return fail(id, 'approving', approved.error);
          const approveTxHash = String(approved.value);
          update(id, { approveTxHash });
          // The vault swap simulates against current chain state, so the approval must be mined first.
          await walletProvider.waitForTransactionReceipt(approveTxHash as Hash);
        } else {
          update(id, { approvalNeeded: null });
        }
      }

      update(id, { phase: 'signing' });
      let srcTxHash: string | undefined;
      const listened = withTxListener(walletProvider, hash => {
        srcTxHash = hash;
        update(id, { srcTxHash: hash, phase: 'relaying' });
      });
      const swapped = await vaultSwap({ ...payload, walletProvider: listened });
      if (!swapped.ok) {
        // Before a hash exists the user never signed; after, the intent is on-chain and the relay/notify failed.
        return fail(id, srcTxHash ? 'relaying' : 'signing', swapped.error);
      }
      update(id, {
        phase: 'filling',
        srcTxHash: srcTxHash ?? swapped.value.intentDeliveryInfo.srcTxHash,
      });
    },
    [sodax, approve, vaultSwap, fail, update],
  );

  // Once the intent is with the solver, follow it until it fills.
  const status = useLeverageYieldDetailedStatus({
    params: {
      srcChainKey: state.phase === 'filling' ? state.srcChainKey : undefined,
      srcTxHash: state.phase === 'filling' ? state.srcTxHash : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  useEffect(() => {
    const result = status.data;
    if (state.phase !== 'filling' || !result?.ok) return;
    const value = result.value;
    const id = runId.current;
    if (value.source === 'backend') {
      if (value.data.status === 'solved') {
        update(id, { phase: 'done', fillTxHash: value.data.result?.fillTxHash });
      } else if (value.data.status === 'failed') {
        update(id, {
          phase: 'failed',
          failedAt: 'filling',
          error: value.data.userMessage ?? 'The solver couldn’t fill this intent. Your funds are refundable.',
        });
      }
    } else if (value.data.status === SolverIntentStatusCode.SOLVED) {
      update(id, { phase: 'done', fillTxHash: value.data.fill_tx_hash });
    } else if (value.data.status === SolverIntentStatusCode.FAILED) {
      update(id, { phase: 'failed', failedAt: 'filling', error: 'The solver couldn’t fill this intent.' });
    }
  }, [status.data, state.phase, update]);

  // Fresh balances and shares once it's done.
  useEffect(() => {
    if (state.phase === 'done') void queryClient.invalidateQueries();
  }, [state.phase, queryClient]);

  const reset = useCallback(() => {
    runId.current++;
    setState(IDLE);
  }, []);

  const isBusy = !['idle', 'done', 'failed'].includes(state.phase);
  const skipsRelay = state.srcChainKey === ChainKeys.SONIC_MAINNET;
  return { state, run, reset, isBusy, skipsRelay };
}
