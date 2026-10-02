import {
  isUserRejectedError,
  useLeverageYieldDeposit,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { Address, IEvmWalletProvider } from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { isHex } from 'viem';
import type { SourceChainKey } from '@/config/workshop';

export type VaultSwapAction = 'deposit' | 'withdraw';

export type VaultSwapStep = 'build' | 'approve' | 'submit' | 'fill';
export type StepState = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

export type DepositRequest = {
  action: 'deposit';
  vault: Address;
  srcChainKey: SourceChainKey;
  srcAddress: string;
  inputToken: string;
  inputAmount: bigint;
  minOutputAmount: bigint;
};

export type WithdrawRequest = {
  action: 'withdraw';
  vault: Address;
  srcChainKey: SourceChainKey;
  srcAddress: string;
  dstChainKey: SourceChainKey;
  outputToken: string;
  inputAmount: bigint;
  minOutputAmount: bigint;
};

export type VaultSwapRequest = DepositRequest | WithdrawRequest;

export type VaultSwapFlowState = {
  /** idle → running (build/approve/submit) → filling (solver) → solved | failed | rejected. */
  phase: 'idle' | 'running' | 'filling' | 'solved' | 'failed' | 'rejected';
  action: VaultSwapAction | undefined;
  steps: Record<VaultSwapStep, StepState>;
  error: string | undefined;
  approveTxHash: string | undefined;
  srcTxHash: string | undefined;
  dstTxHash: string | undefined;
  srcChainKey: SourceChainKey | undefined;
};

const IDLE: VaultSwapFlowState = {
  phase: 'idle',
  action: undefined,
  steps: { build: 'pending', approve: 'pending', submit: 'pending', fill: 'pending' },
  error: undefined,
  approveTxHash: undefined,
  srcTxHash: undefined,
  dstTxHash: undefined,
  srcChainKey: undefined,
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: { message?: string } }).detail;
    if (detail?.message) return detail.message;
  }
  return String(error);
}

/**
 * Drives one vault swap end to end: build the payload, approve the input token when the allowance
 * is short (deposits only), execute via `vaultSwap`, then hand off to status polling ("filling").
 * The caller (VaultSwapDialog) polls `useLeverageYieldDetailedStatus` while `phase === 'filling'`
 * and settles the flow with `markSolved` / `markFailed`.
 */
export function useVaultSwapFlow() {
  const { sodax } = useSodaxContext();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VaultSwapFlowState>(IDLE);

  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();

  const patch = useCallback((update: Partial<VaultSwapFlowState>) => setState(prev => ({ ...prev, ...update })), []);
  const setStep = useCallback(
    (step: VaultSwapStep, stepState: StepState) =>
      setState(prev => ({ ...prev, steps: { ...prev.steps, [step]: stepState } })),
    [],
  );

  /** Refresh balances/positions after on-chain state moved (now, and again once the fill lands). */
  const invalidateReads = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leverageYield'] });
    queryClient.invalidateQueries({ queryKey: ['shared'] });
  }, [queryClient]);

  const start = useCallback(
    async (request: VaultSwapRequest, walletProvider: IEvmWalletProvider) => {
      setState({
        ...IDLE,
        phase: 'running',
        action: request.action,
        srcChainKey: request.srcChainKey,
        steps: {
          build: 'active',
          // A withdraw spends shares from the hub wallet; no spoke-side approval exists for it.
          approve: request.action === 'withdraw' ? 'skipped' : 'pending',
          submit: 'pending',
          fill: 'pending',
        },
      });

      const fail = (step: VaultSwapStep, error: unknown) => {
        setStep(step, 'failed');
        patch({ phase: 'failed', error: describeError(error) });
      };
      const rejected = (step: VaultSwapStep) => {
        setStep(step, 'failed');
        patch({ phase: 'rejected', error: 'Transaction rejected in your wallet.' });
      };

      const built = await (request.action === 'deposit'
        ? buildDeposit({
            vault: request.vault,
            srcChainKey: request.srcChainKey,
            srcAddress: request.srcAddress,
            inputToken: request.inputToken,
            inputAmount: request.inputAmount,
            minOutputAmount: request.minOutputAmount,
          })
        : buildWithdraw({
            vault: request.vault,
            srcChainKey: request.srcChainKey,
            srcAddress: request.srcAddress,
            dstChainKey: request.dstChainKey,
            outputToken: request.outputToken,
            inputAmount: request.inputAmount,
            minOutputAmount: request.minOutputAmount,
          }));
      if (!built.ok) return fail('build', built.error);
      setStep('build', 'done');

      if (request.action === 'deposit') {
        const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, walletProvider });
        if (!allowance.ok) return fail('approve', allowance.error);
        if (allowance.value) {
          setStep('approve', 'skipped');
        } else {
          setStep('approve', 'active');
          const approval = await approve({ params: built.value.params, walletProvider });
          if (!approval.ok) {
            return isUserRejectedError(approval.error) ? rejected('approve') : fail('approve', approval.error);
          }
          // The deposit spends this allowance next, so the approval must be mined and not reverted.
          if (isHex(approval.value)) {
            patch({ approveTxHash: approval.value });
            try {
              const receipt = await walletProvider.waitForTransactionReceipt(approval.value);
              if (receipt.status === 'reverted' || receipt.status === '0x0') {
                return fail('approve', new Error('Approval transaction reverted'));
              }
            } catch (error) {
              return fail('approve', error);
            }
          }
          setStep('approve', 'done');
        }
      }

      setStep('submit', 'active');
      const result = await vaultSwap({ ...built.value, walletProvider });
      if (!result.ok) {
        return isUserRejectedError(result.error) ? rejected('submit') : fail('submit', result.error);
      }
      setStep('submit', 'done');
      setStep('fill', 'active');
      patch({
        phase: 'filling',
        srcTxHash: result.value.intentDeliveryInfo.srcTxHash,
        dstTxHash: result.value.intentDeliveryInfo.dstTxHash,
      });
      invalidateReads();
    },
    [approve, buildDeposit, buildWithdraw, invalidateReads, patch, setStep, sodax, vaultSwap],
  );

  const markSolved = useCallback(
    (dstTxHash?: string) => {
      setState(prev =>
        prev.phase === 'filling'
          ? {
              ...prev,
              phase: 'solved',
              steps: { ...prev.steps, fill: 'done' },
              dstTxHash: dstTxHash ?? prev.dstTxHash,
            }
          : prev,
      );
      invalidateReads();
    },
    [invalidateReads],
  );

  const markFailed = useCallback((error: string) => {
    setState(prev =>
      prev.phase === 'filling' ? { ...prev, phase: 'failed', error, steps: { ...prev.steps, fill: 'failed' } } : prev,
    );
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  return { state, start, markSolved, markFailed, reset };
}
