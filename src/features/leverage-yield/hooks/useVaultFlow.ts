import {
  useLeverageYieldDeposit,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { IEvmWalletProvider, LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError, isRejection } from '../lib/errors';
import { withTxListener } from '../lib/txListener';
import { type IntentPhase, useIntentStatus } from './useIntentStatus';

export type FlowStep = 'idle' | 'preparing' | 'approving' | 'signing' | 'submitted' | 'done' | 'error';

export type FlowState = {
  step: FlowStep;
  /** Set once we know whether an approve transaction was needed (deposits only). */
  needsApproval?: boolean;
  approveTxHash?: string;
  srcTxHash?: string;
  dstTxHash?: string;
  error?: string;
  failedAt?: FlowStep;
};

export type DepositInput = {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  token: XToken;
  inputAmount: bigint;
  minShares: bigint;
  walletProvider: IEvmWalletProvider;
};

export type WithdrawInput = {
  vault: LeverageYieldVault;
  /** The network that deposited: its hub wallet holds the shares, and the user signs there. */
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  dstChainKey: SpokeChainKey;
  outputToken: XToken;
  shares: bigint;
  minAmountOut: bigint;
  walletProvider: IEvmWalletProvider;
};

/** After this long without a fill, the wizard stops spinning and says so (the order may still complete). */
const FILL_TIMEOUT_MS = 6 * 60_000;

/**
 * Deposit and withdraw flows, plus live tracking.
 *
 * Deposit: build payload → approve the spoke token if the allowance is short (and wait for it to be mined) →
 * vaultSwap. Withdraw: build payload → vaultSwap (no approval: the payload has `hubWalletSwap: true`).
 * The payload is built at confirm time, because its deadline is ~5 minutes from the hub block time.
 */
export function useVaultFlow(srcChainKey: SpokeChainKey) {
  const { sodax } = useSodaxContext();
  const queryClient = useQueryClient();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [state, setState] = useState<FlowState>({ step: 'idle' });
  const stepRef = useRef<FlowStep>('idle');

  const patch = useCallback((next: Partial<FlowState>) => {
    setState(prev => {
      const merged = { ...prev, ...next };
      stepRef.current = merged.step;
      return merged;
    });
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      if (isRejection(error)) {
        // Cancelled in the wallet: back to the form quietly, keeping nothing half-done.
        setState({ step: 'idle' });
        stepRef.current = 'idle';
        return;
      }
      patch({ step: 'error', failedAt: stepRef.current, error: friendlyError(error) });
    },
    [patch],
  );

  const deposit = useCallback(
    async (input: DepositInput) => {
      setState({ step: 'preparing' });
      stepRef.current = 'preparing';
      if (input.minShares <= 0n) return fail(new Error('Minimum received must be greater than 0.'));
      const built = await buildDeposit({
        vault: input.vault.vault,
        srcChainKey: input.srcChainKey,
        srcAddress: input.srcAddress,
        inputToken: input.token.address,
        inputAmount: input.inputAmount,
        minOutputAmount: input.minShares,
      });
      if (!built.ok) return fail(built.error);
      const payload = built.value;

      const allowance = await sodax.swaps.isAllowanceValid({
        params: payload.params,
        raw: false,
        walletProvider: input.walletProvider,
      });
      if (!allowance.ok) return fail(allowance.error);
      patch({ needsApproval: !allowance.value });
      if (!allowance.value) {
        patch({ step: 'approving' });
        const approved = await approve({
          params: payload.params,
          walletProvider: withTxListener(input.walletProvider, hash => patch({ approveTxHash: hash })),
        });
        if (!approved.ok) return fail(approved.error);
        try {
          const receipt = await input.walletProvider.waitForTransactionReceipt(approved.value as `0x${string}`);
          if (receipt.status === 'reverted' || receipt.status === '0x0') {
            return fail(new Error('The approval failed on-chain. Check your gas balance and try again.'));
          }
        } catch (error) {
          return fail(error);
        }
      }

      patch({ step: 'signing' });
      const result = await vaultSwap({
        ...payload,
        walletProvider: withTxListener(input.walletProvider, hash =>
          setState(prev => (prev.srcTxHash ? prev : { ...prev, srcTxHash: hash })),
        ),
      });
      if (!result.ok) return fail(result.error);
      patch({
        step: 'submitted',
        srcTxHash: result.value.intentDeliveryInfo.srcTxHash,
        dstTxHash: result.value.intentDeliveryInfo.dstTxHash,
      });
    },
    [sodax, buildDeposit, approve, vaultSwap, patch, fail],
  );

  const withdraw = useCallback(
    async (input: WithdrawInput) => {
      setState({ step: 'preparing', needsApproval: false });
      stepRef.current = 'preparing';
      if (input.minAmountOut <= 0n) return fail(new Error('Minimum received must be greater than 0.'));
      const built = await buildWithdraw({
        vault: input.vault.vault,
        srcChainKey: input.srcChainKey,
        srcAddress: input.srcAddress,
        dstChainKey: input.dstChainKey,
        outputToken: input.outputToken.address,
        inputAmount: input.shares,
        minOutputAmount: input.minAmountOut,
      });
      if (!built.ok) return fail(built.error);
      patch({ step: 'signing' });
      const result = await vaultSwap({
        ...built.value,
        walletProvider: withTxListener(input.walletProvider, hash =>
          setState(prev => (prev.srcTxHash ? prev : { ...prev, srcTxHash: hash })),
        ),
      });
      if (!result.ok) return fail(result.error);
      patch({
        step: 'submitted',
        srcTxHash: result.value.intentDeliveryInfo.srcTxHash,
        dstTxHash: result.value.intentDeliveryInfo.dstTxHash,
      });
    },
    [buildWithdraw, vaultSwap, patch, fail],
  );

  const status = useIntentStatus(srcChainKey, state.srcTxHash);

  // Promote to done/error from the live status once the order is on its way.
  useEffect(() => {
    if (state.step !== 'submitted' && state.step !== 'signing') return;
    if (status.phase === 'filled') patch({ step: 'done' });
    if (status.phase === 'failed' && state.step === 'submitted') {
      patch({
        step: 'error',
        failedAt: 'submitted',
        error: status.message ?? 'The order was not filled before its deadline. Your funds were not converted.',
      });
    }
  }, [status.phase, status.message, state.step, patch]);

  useEffect(() => {
    if (state.step === 'done') void queryClient.invalidateQueries({ queryKey: ['leverageYield', 'shareBalance'] });
  }, [state.step, queryClient]);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (state.step !== 'submitted') return;
    const timer = setTimeout(() => setTimedOut(true), FILL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state.step]);

  const reset = useCallback(() => {
    setState({ step: 'idle' });
    stepRef.current = 'idle';
  }, []);

  return {
    state,
    phase: status.phase as IntentPhase,
    fillTxHash: status.fillTxHash,
    timedOut,
    deposit,
    withdraw,
    reset,
  };
}

export function isBusy(step: FlowStep): boolean {
  return step === 'preparing' || step === 'approving' || step === 'signing';
}
