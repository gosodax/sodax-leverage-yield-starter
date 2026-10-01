import { isUserRejectedError, useLeverageYieldVaultSwap, useSodaxContext, useSwapApprove } from '@sodax/dapp-kit';
import type { LeverageYieldSwapPayload, Result } from '@sodax/sdk';
import { ChainKeys, type IEvmWalletProvider } from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { SourceChainKey } from '@/config/workshop';
import { explorerTxUrl } from '@/lib/chains';
import type { Step } from './TxSteps';
import { useVaultSwapStatus } from './useVaultSwapStatus';

type Stage = 'idle' | 'building' | 'approving' | 'signing' | 'filling' | 'done' | 'failed';

type FlowState = {
  stage: Stage;
  /** Which stage the failure happened in, so the right step turns red. */
  failedAt?: Exclude<Stage, 'idle' | 'done' | 'failed'>;
  approval: 'unknown' | 'needed' | 'skipped' | 'done';
  approveTxHash?: string;
  srcTxHash?: string;
  error?: string;
};

const IDLE: FlowState = { stage: 'idle', approval: 'unknown' };

function describeError(error: unknown, fallback: string): string {
  if (isUserRejectedError(error)) return 'You rejected the request in your wallet.';
  return error instanceof Error && error.message ? error.message : fallback;
}

type RunArgs = {
  /** Builds a fresh payload (fresh deadline) right before signing. */
  build: () => Promise<Result<LeverageYieldSwapPayload, unknown>>;
  walletProvider: IEvmWalletProvider;
  srcChainKey: SourceChainKey;
  /** Deposits approve the spoke token first; withdraws never do (the hub wallet authorises the share spend). */
  checkApproval: boolean;
};

/**
 * Runs a vault deposit or withdraw end to end: build → approve (deposit only, if needed) → sign + relay → fill.
 * Every SDK call returns a Result; nothing here throws.
 */
export function useVaultSwapFlow(kind: 'deposit' | 'withdraw') {
  const { sodax } = useSodaxContext();
  const queryClient = useQueryClient();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [state, setState] = useState<FlowState>(IDLE);
  const [srcChainKey, setSrcChainKey] = useState<SourceChainKey>();

  const status = useVaultSwapStatus(srcChainKey, state.stage === 'filling' ? state.srcTxHash : undefined);

  // Advance from "filling" once the fill is terminal, and refresh share balances.
  useEffect(() => {
    if (state.stage !== 'filling') return;
    if (status.phase === 'solved') {
      setState(s => ({ ...s, stage: 'done' }));
      void queryClient.invalidateQueries({ queryKey: ['leverageYield'] });
    } else if (status.phase === 'failed') {
      setState(s => ({
        ...s,
        stage: 'failed',
        failedAt: 'filling',
        error: status.failureReason ?? 'The intent was not filled. Your funds are refunded by the protocol.',
      }));
    }
  }, [state.stage, status.phase, status.failureReason, queryClient]);

  const run = useCallback(
    async ({ build, walletProvider, srcChainKey: chainKey, checkApproval }: RunArgs) => {
      setSrcChainKey(chainKey);
      setState({ ...IDLE, stage: 'building' });

      const built = await build();
      if (!built.ok) {
        setState({
          ...IDLE,
          stage: 'failed',
          failedAt: 'building',
          error: describeError(built.error, 'Could not build the intent.'),
        });
        return;
      }
      const payload = built.value;

      let approval: FlowState['approval'] = 'skipped';
      let approveTxHash: string | undefined;
      if (checkApproval) {
        const allowance = await sodax.swaps.isAllowanceValid({ params: payload.params, walletProvider });
        if (!allowance.ok) {
          setState({
            ...IDLE,
            stage: 'failed',
            failedAt: 'approving',
            error: describeError(allowance.error, 'Could not read the token allowance.'),
          });
          return;
        }
        if (!allowance.value) {
          setState({ ...IDLE, stage: 'approving', approval: 'needed' });
          const approved = await approve({ params: payload.params, walletProvider });
          if (!approved.ok) {
            setState({
              ...IDLE,
              stage: 'failed',
              failedAt: 'approving',
              approval: 'needed',
              error: describeError(approved.error, 'Approval failed.'),
            });
            return;
          }
          approveTxHash = String(approved.value);
          // The deposit simulates against the allowance, so wait for the approval to be mined.
          await walletProvider.waitForTransactionReceipt(approveTxHash as `0x${string}`);
          approval = 'done';
        }
      }

      setState({ stage: 'signing', approval, approveTxHash });
      const swapped = await vaultSwap({ ...payload, walletProvider });
      if (!swapped.ok) {
        setState({
          stage: 'failed',
          failedAt: 'signing',
          approval,
          approveTxHash,
          error: describeError(swapped.error, `The ${kind} failed.`),
        });
        return;
      }
      setState({ stage: 'filling', approval, approveTxHash, srcTxHash: swapped.value.intentDeliveryInfo.srcTxHash });
    },
    [sodax, approve, vaultSwap, kind],
  );

  const reset = useCallback(() => setState(IDLE), []);

  const steps: Step[] = [];
  const order: Stage[] = ['building', 'approving', 'signing', 'filling', 'done'];
  const reached = (stage: Stage) => {
    const current = state.stage === 'failed' ? (state.failedAt ?? 'building') : state.stage;
    return order.indexOf(current) - order.indexOf(stage);
  };
  const stateOf = (stage: Stage): Step['state'] => {
    if (state.stage === 'failed' && state.failedAt === stage) return 'error';
    const diff = reached(stage);
    if (diff > 0) return 'done';
    if (diff === 0 && state.stage !== 'failed') return 'active';
    return 'pending';
  };

  if (kind === 'deposit') {
    steps.push({
      label: 'Approve token',
      state: state.approval === 'skipped' ? 'skipped' : stateOf('approving'),
      detail: state.stage === 'approving' ? 'Confirm the approval in your wallet' : undefined,
      link:
        state.approveTxHash && srcChainKey
          ? { href: explorerTxUrl(srcChainKey, state.approveTxHash) ?? '#', label: 'Approval tx' }
          : undefined,
    });
  }
  steps.push({
    label: kind === 'deposit' ? 'Sign deposit' : 'Sign withdrawal',
    state: stateOf('signing'),
    detail: state.stage === 'signing' ? 'Confirm in your wallet, then the intent is relayed to the hub' : undefined,
    link:
      state.srcTxHash && srcChainKey
        ? { href: explorerTxUrl(srcChainKey, state.srcTxHash) ?? '#', label: 'Source tx' }
        : undefined,
  });
  steps.push({
    label: kind === 'deposit' ? 'Solver fills, shares arrive' : 'Solver fills, tokens arrive',
    state: state.stage === 'done' ? 'done' : stateOf('filling'),
    detail: state.stage === 'filling' ? 'Usually under a minute' : undefined,
    link: status.fillTxHash
      ? { href: explorerTxUrl(ChainKeys.SONIC_MAINNET, status.fillTxHash) ?? '#', label: 'Fill tx on Sonic' }
      : status.hubTxHash
        ? { href: explorerTxUrl(ChainKeys.SONIC_MAINNET, status.hubTxHash) ?? '#', label: 'Intent on Sonic' }
        : undefined,
  });

  return { state, steps, run, reset, busy: ['building', 'approving', 'signing', 'filling'].includes(state.stage) };
}
