import {
  useLeverageYieldDeposit,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { IEvmWalletProvider, LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useState } from 'react';
import { flowError } from '../lib/errors';
import { withTxListener } from '../lib/txListener';

export type FlowState = {
  status: 'idle' | 'running' | 'done' | 'error';
  /** The step being worked on: wallet approval, wallet signature, then delivery + fill (tracked by status). */
  step?: 'approve' | 'sign' | 'track';
  approveTxHash?: string;
  srcTxHash?: string;
  error?: string;
};

const IDLE: FlowState = { status: 'idle' };

function useFlowState() {
  const [state, setState] = useState<FlowState>(IDLE);
  const patch = (next: Partial<FlowState>) => setState(prev => ({ ...prev, ...next }));
  return { state, patch, reset: () => setState(IDLE) };
}

type DepositArgs = {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  token: XToken;
  amount: bigint;
  minShares: bigint;
  walletProvider: IEvmWalletProvider;
};

/** Spoke token → vault shares: build the intent, approve if needed, sign, then wait for the solver fill. */
export function useDepositFlow() {
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const { state, patch, reset } = useFlowState();

  async function run({ vault, srcChainKey, srcAddress, token, amount, minShares, walletProvider }: DepositArgs) {
    if (minShares <= 0n) return patch({ status: 'error', error: 'No live quote yet.' });
    patch({ status: 'running', step: 'sign', error: undefined, approveTxHash: undefined, srcTxHash: undefined });
    try {
      // Built at confirm time: the intent deadline is hub time + 5 minutes.
      const built = await buildDeposit({
        vault: vault.vault,
        srcChainKey,
        srcAddress,
        inputToken: token.address,
        inputAmount: amount,
        minOutputAmount: minShares,
      });
      if (!built.ok) throw built.error;

      const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, raw: false, walletProvider });
      if (!allowance.ok) throw allowance.error;
      if (!allowance.value) {
        patch({ step: 'approve' });
        const approved = await approve({
          params: built.value.params,
          walletProvider: withTxListener(walletProvider, hash => patch({ approveTxHash: hash })),
        });
        if (!approved.ok) throw approved.error;
        const receipt = await walletProvider.waitForTransactionReceipt(approved.value as `0x${string}`);
        if (receipt.status === 'reverted' || receipt.status === '0x0') throw new Error('The approval reverted.');
        patch({ step: 'sign' });
      }

      const result = await vaultSwap({
        ...built.value,
        walletProvider: withTxListener(walletProvider, hash => patch({ step: 'track', srcTxHash: hash })),
      });
      if (!result.ok) throw result.error;
      patch({ status: 'done', step: 'track' });
    } catch (error) {
      patch({ status: 'error', error: flowError(error) });
    }
  }

  return { state, run, reset };
}

type WithdrawArgs = {
  vault: LeverageYieldVault;
  /** The chain the shares are held under: the one the user deposited from. */
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  dstChainKey: SpokeChainKey;
  token: XToken;
  shares: bigint;
  minOut: bigint;
  walletProvider: IEvmWalletProvider;
};

/** Vault shares → token: one signature (a hub-wallet message), no approval. */
export function useWithdrawFlow() {
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const { state, patch, reset } = useFlowState();

  async function run({
    vault,
    srcChainKey,
    srcAddress,
    dstChainKey,
    token,
    shares,
    minOut,
    walletProvider,
  }: WithdrawArgs) {
    if (minOut <= 0n) return patch({ status: 'error', error: 'No live quote yet.' });
    patch({ status: 'running', step: 'sign', error: undefined, srcTxHash: undefined });
    try {
      const built = await buildWithdraw({
        vault: vault.vault,
        srcChainKey,
        srcAddress,
        dstChainKey,
        outputToken: token.address,
        inputAmount: shares,
        minOutputAmount: minOut,
      });
      if (!built.ok) throw built.error;
      const result = await vaultSwap({
        ...built.value,
        walletProvider: withTxListener(walletProvider, hash => patch({ step: 'track', srcTxHash: hash })),
      });
      if (!result.ok) throw result.error;
      patch({ status: 'done', step: 'track' });
    } catch (error) {
      patch({ status: 'error', error: flowError(error) });
    }
  }

  return { state, run, reset };
}
