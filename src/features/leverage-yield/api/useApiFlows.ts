import {
  useLeverageYieldApiApproveAndBroadcast,
  useLeverageYieldApiCreateDepositIntent,
  useLeverageYieldApiCreateWithdrawIntent,
  useLeverageYieldApiSubmitTx,
  useSodaxContext,
} from '@sodax/dapp-kit';
import { getEvmViemChain } from '@sodax/sdk';
import type {
  CreateIntentResponseV2,
  EvmChainKey,
  EvmRawTransaction,
  IEvmWalletProvider,
  SpokeChainKey,
} from '@sodax/types';
import { useCallback } from 'react';
import { useFlowState } from '../hooks/useFlowState';
import type { DepositInput } from '../hooks/useVaultDeposit';
import type { WithdrawInput } from '../hooks/useVaultWithdraw';
import { withTxListener } from '../lib/withTxListener';
import { toIntentRequest } from './wire';

/**
 * API-mode deposit and withdraw. Same inputs and FlowState as useVaultDeposit / useVaultWithdraw, so the
 * dialogs don't care which transport runs. The API builds unsigned transactions; the wallet signs them:
 *
 *   deposit:  check allowance → approve (API builds, wallet signs) → create intent → sign → submit-tx
 *   withdraw:                                                         create intent → sign → submit-tx
 *
 * The flow stops at 'processing' after submit-tx; the dialog's live status (useFlowProgress) marks it done.
 */
function useSignAndSubmit() {
  const { mutateAsyncSafe: submitTx } = useLeverageYieldApiSubmitTx();

  return useCallback(
    async (
      operation: 'deposit' | 'withdraw',
      created: CreateIntentResponseV2,
      srcChainKey: SpokeChainKey,
      srcAddress: string,
      walletProvider: IEvmWalletProvider,
    ) => {
      // 1. Sign + broadcast the unsigned intent tx on the source chain (bound to that chain's id).
      const txHash = await walletProvider.sendTransaction(created.tx as EvmRawTransaction, {
        expectedChainId: getEvmViemChain(srcChainKey as EvmChainKey).id,
      });
      // 2. Hand it back to the API, which relays it to Sonic and notifies solvers.
      const submitted = await submitTx({
        request: {
          txHash,
          srcChainKey,
          walletAddress: srcAddress,
          intent: toIntentRequest(created.intent),
          relayData: created.relayData.payload,
          operation,
        },
      });
      if (!submitted.ok) throw submitted.error;
      return txHash;
    },
    [submitTx],
  );
}

export function useApiVaultDeposit() {
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: approve } = useLeverageYieldApiApproveAndBroadcast();
  const { mutateAsyncSafe: createDepositIntent } = useLeverageYieldApiCreateDepositIntent();
  const signAndSubmit = useSignAndSubmit();
  const { state, patch, run } = useFlowState();

  const deposit = useCallback(
    (input: DepositInput) =>
      run(async () => {
        if (input.minShares <= 0n) throw new Error('Minimum received must be greater than 0.');
        const body = {
          vault: input.vault.vault,
          srcChainKey: input.srcChainKey,
          srcAddress: input.srcAddress,
          inputToken: input.token.address,
          inputAmount: input.inputAmount.toString(),
          minOutputAmount: input.minShares.toString(),
        };
        const allowance = await sodax.api.leverageYield.checkAllowance(body);
        if (!allowance.ok) throw allowance.error;
        if (!allowance.value.valid) {
          patch({ step: 'approving' });
          // The hook plans, signs, broadcasts and waits for the approval (incl. USDT-style resets).
          const approved = await approve({
            body,
            walletProvider: withTxListener(input.walletProvider, hash => patch({ approveTxHash: hash })),
          });
          if (!approved.ok) throw approved.error;
        }
        patch({ step: 'signing' });
        const created = await createDepositIntent({ body });
        if (!created.ok) throw created.error;
        const txHash = await signAndSubmit(
          'deposit',
          created.value,
          input.srcChainKey,
          input.srcAddress,
          input.walletProvider,
        );
        patch({ step: 'processing', srcTxHash: txHash, handedOff: true });
      }),
    [sodax, approve, createDepositIntent, signAndSubmit, patch, run],
  );

  return { state, deposit };
}

export function useApiVaultWithdraw() {
  const { mutateAsyncSafe: createWithdrawIntent } = useLeverageYieldApiCreateWithdrawIntent();
  const signAndSubmit = useSignAndSubmit();
  const { state, patch, run } = useFlowState();

  const withdraw = useCallback(
    (input: WithdrawInput) =>
      run(async () => {
        if (input.minAmountOut <= 0n) throw new Error('Minimum received must be greater than 0.');
        const created = await createWithdrawIntent({
          body: {
            vault: input.vault.vault,
            srcChainKey: input.srcChainKey,
            srcAddress: input.srcAddress,
            dstChainKey: input.dstChainKey,
            outputToken: input.outputToken.address,
            inputAmount: input.shares.toString(),
            minOutputAmount: input.minAmountOut.toString(),
          },
        });
        if (!created.ok) throw created.error;
        patch({ step: 'signing' });
        const txHash = await signAndSubmit(
          'withdraw',
          created.value,
          input.srcChainKey,
          input.srcAddress,
          input.walletProvider,
        );
        patch({ step: 'processing', srcTxHash: txHash, handedOff: true });
      }),
    [createWithdrawIntent, signAndSubmit, patch, run],
  );

  return { state, withdraw };
}
