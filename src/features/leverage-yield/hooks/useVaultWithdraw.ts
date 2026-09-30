import { useLeverageYieldVaultSwap, useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import type { IEvmWalletProvider, LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useCallback } from 'react';
import { withTxListener } from '../lib/withTxListener';
import { useFlowState } from './useFlowState';

export type WithdrawInput = {
  vault: LeverageYieldVault;
  /** Chain the shares are held under (the chain the deposit came from). The user signs here. */
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  dstChainKey: SpokeChainKey;
  outputToken: XToken;
  shares: bigint;
  /** From the quote, after slippage. Never 0. */
  minAmountOut: bigint;
  walletProvider: IEvmWalletProvider;
};

/**
 * Withdraw flow: build payload → vaultSwap. No approval: the payload has `hubWalletSwap: true`, so the user
 * signs one `sendMessage` on `srcChainKey` authorising the hub wallet to spend its lsoda* shares.
 */
export function useVaultWithdraw() {
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const { state, patch, run } = useFlowState();

  const withdraw = useCallback(
    (input: WithdrawInput) =>
      run(async () => {
        if (input.minAmountOut <= 0n) throw new Error('Minimum received must be greater than 0.');
        const built = await buildWithdraw({
          vault: input.vault.vault,
          srcChainKey: input.srcChainKey,
          srcAddress: input.srcAddress,
          dstChainKey: input.dstChainKey,
          outputToken: input.outputToken.address,
          inputAmount: input.shares,
          minOutputAmount: input.minAmountOut,
        });
        if (!built.ok) throw built.error;

        patch({ step: 'signing' });
        const result = await vaultSwap({
          ...built.value,
          walletProvider: withTxListener(input.walletProvider, hash => patch({ step: 'processing', srcTxHash: hash })),
        });
        if (!result.ok) throw result.error;
        patch({ step: 'done', srcTxHash: result.value.intentDeliveryInfo.srcTxHash });
      }),
    [buildWithdraw, vaultSwap, patch, run],
  );

  return { state, withdraw };
}
