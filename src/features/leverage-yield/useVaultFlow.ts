import {
  isUserRejectedError,
  useLeverageYieldDeposit,
  useLeverageYieldDetailedStatus,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type {
  DetailedLeverageYieldStatus,
  LeverageYieldSwapDepositParams,
  LeverageYieldSwapWithdrawParams,
} from '@sodax/sdk';
import { type IEvmWalletProvider, SolverIntentStatusCode, type SpokeChainKey } from '@sodax/types';
import { useCallback, useState } from 'react';
import { isHex } from 'viem';
import { REFETCH_MS } from '@/config/workshop';
import { errorMessage } from './helpers';

/** Stop polling a fill after this long; the position card and the explorer link still show what happened. */
const MAX_TRACK_MS = 10 * 60 * 1000;

export type FlowStage = 'idle' | 'preparing' | 'approving' | 'signing' | 'filling' | 'done' | 'failed';

export type FlowState = {
  stage: FlowStage;
  /** Which step failed, so the dialog can mark it. */
  failedAt?: 'preparing' | 'approving' | 'signing' | 'filling';
  error?: string;
  approvalHash?: string;
  /** The transaction the user signed on the source network. */
  srcTxHash?: string;
  srcChainKey?: SpokeChainKey;
  /** Hub (Sonic) transaction where the solver delivered, once known. */
  dstTxHash?: string;
  needsApproval?: boolean;
};

type FillState = { kind: 'pending' } | { kind: 'solved'; dstTxHash?: string } | { kind: 'failed'; message: string };

function readFill(status: DetailedLeverageYieldStatus): FillState {
  if (status.source === 'backend') {
    const { data } = status;
    if (data.status === 'solved') return { kind: 'solved', dstTxHash: data.result?.fillTxHash };
    if (data.status === 'failed')
      return {
        kind: 'failed',
        message: data.userMessage ?? data.failureReason ?? 'The solver could not fill this order.',
      };
    return { kind: 'pending' };
  }
  if (status.data.status === SolverIntentStatusCode.SOLVED) {
    return { kind: 'solved', dstTxHash: status.data.fill_tx_hash ?? status.dstTxHash };
  }
  if (status.data.status === SolverIntentStatusCode.FAILED) {
    return { kind: 'failed', message: 'The solver could not fill this order.' };
  }
  return { kind: 'pending' };
}

const startedAt = new Map<string, number>();

type RunArgs =
  | { direction: 'deposit'; params: LeverageYieldSwapDepositParams; walletProvider: IEvmWalletProvider }
  | { direction: 'withdraw'; params: LeverageYieldSwapWithdrawParams; walletProvider: IEvmWalletProvider };

/**
 * Runs one deposit or withdraw end to end and tracks the fill: build the payload, approve (deposit only, only if the
 * allowance is short), sign and submit with `vaultSwap`, then follow the order from its source transaction.
 * `params.minOutputAmount` must come from a live quote minus slippage. Never 0.
 */
export function useVaultFlow() {
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [state, setState] = useState<FlowState>({ stage: 'idle' });

  const trackKey = state.srcTxHash ? `${state.srcChainKey}:${state.srcTxHash}` : undefined;
  const status = useLeverageYieldDetailedStatus({
    params: { srcChainKey: state.srcChainKey, srcTxHash: state.srcTxHash },
    queryOptions: {
      // The SDK default polls every 3s; a room shares one IP, so stay at REFETCH_MS and stop at a terminal state.
      refetchInterval: query => {
        const result = query.state.data;
        if (result?.ok && readFill(result.value).kind !== 'pending') return false;
        if (trackKey && Date.now() - (startedAt.get(trackKey) ?? Date.now()) > MAX_TRACK_MS) return false;
        return REFETCH_MS;
      },
    },
  });

  // Derive the terminal state from the tracked status instead of mirroring it into state with an effect.
  let view = state;
  if (state.stage === 'filling' && status.data?.ok) {
    const fill = readFill(status.data.value);
    if (fill.kind === 'solved') view = { ...state, stage: 'done', dstTxHash: fill.dstTxHash };
    if (fill.kind === 'failed') view = { ...state, stage: 'failed', failedAt: 'filling', error: fill.message };
  }

  const run = useCallback(
    async (args: RunArgs) => {
      const { walletProvider } = args;
      const fail = (failedAt: FlowState['failedAt'], error: unknown) =>
        setState(prev => ({ ...prev, stage: 'failed', failedAt, error: errorMessage(error) }));
      // A user cancelling in the wallet isn't an error: go back to the confirm step.
      const cancelled = (error: unknown) => {
        if (!isUserRejectedError(error)) return false;
        setState({ stage: 'idle' });
        return true;
      };

      setState({ stage: 'preparing', srcChainKey: args.params.srcChainKey });

      const built = args.direction === 'deposit' ? await buildDeposit(args.params) : await buildWithdraw(args.params);
      if (!built.ok) return fail('preparing', built.error);

      if (args.direction === 'deposit') {
        const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, walletProvider });
        if (!allowance.ok) return fail('preparing', allowance.error);
        if (!allowance.value) {
          setState(prev => ({ ...prev, stage: 'approving', needsApproval: true }));
          const approval = await approve({ params: built.value.params, walletProvider });
          if (!approval.ok) return cancelled(approval.error) ? undefined : fail('approving', approval.error);
          setState(prev => ({ ...prev, approvalHash: String(approval.value) }));
          // The deposit spends this allowance next, so it has to be mined and not reverted.
          if (isHex(approval.value)) {
            try {
              const receipt = await walletProvider.waitForTransactionReceipt(approval.value);
              if (receipt.status === 'reverted' || receipt.status === '0x0')
                return fail('approving', 'Approval reverted');
            } catch (e) {
              return fail('approving', e);
            }
          }
        }
      }

      setState(prev => ({ ...prev, stage: 'signing' }));
      const result = await vaultSwap({ ...built.value, walletProvider });
      if (!result.ok) return cancelled(result.error) ? undefined : fail('signing', result.error);

      const { srcTxHash, srcChainKey } = result.value.intentDeliveryInfo;
      startedAt.set(`${srcChainKey}:${srcTxHash}`, Date.now());
      setState(prev => ({ ...prev, stage: 'filling', srcTxHash, srcChainKey }));
    },
    [sodax, buildDeposit, buildWithdraw, approve, vaultSwap],
  );

  const reset = useCallback(() => setState({ stage: 'idle' }), []);

  return {
    state: view,
    run,
    reset,
    /** True once the dialog must not be dismissed casually: a wallet prompt or an order is in flight. */
    busy: view.stage === 'preparing' || view.stage === 'approving' || view.stage === 'signing',
    statusError: status.data && !status.data.ok ? errorMessage(status.data.error) : undefined,
  };
}

export type VaultFlow = ReturnType<typeof useVaultFlow>;
