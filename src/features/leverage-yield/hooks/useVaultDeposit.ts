import { useLeverageYieldDeposit, useLeverageYieldVaultSwap, useSodaxContext, useSwapApprove } from '@sodax/dapp-kit';
import type { IEvmWalletProvider, LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useCallback } from 'react';
import { withTxListener } from '../lib/withTxListener';
import { useFlowState } from './useFlowState';

export type DepositInput = {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  token: XToken;
  inputAmount: bigint;
  /** From the quote, after slippage. Never 0. */
  minShares: bigint;
  walletProvider: IEvmWalletProvider;
};

/**
 * Deposit flow: build payload → approve input token if needed → vaultSwap (sign, submit, solver fill).
 *
 * The payload is built at confirm time, not when the form renders: its deadline is the hub block time +
 * ~5 minutes, so a payload built early can expire while the user reads the review screen.
 */
export function useVaultDeposit() {
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const { state, patch, run } = useFlowState();

  const deposit = useCallback(
    ({ vault, srcChainKey, srcAddress, token, inputAmount, minShares, walletProvider }: DepositInput) =>
      run(async () => {
        if (minShares <= 0n) throw new Error('Minimum received must be greater than 0.');
        const built = await buildDeposit({
          vault: vault.vault,
          srcChainKey,
          srcAddress,
          inputToken: token.address,
          inputAmount,
          minOutputAmount: minShares,
        });
        if (!built.ok) throw built.error;
        const payload = built.value;

        // Approval: the deposit spends `token` via the spoke asset manager (swap-domain allowance).
        const allowance = await sodax.swaps.isAllowanceValid({ params: payload.params, raw: false, walletProvider });
        if (!allowance.ok) throw allowance.error;
        if (!allowance.value) {
          patch({ step: 'approving' });
          const approved = await approve({
            params: payload.params,
            walletProvider: withTxListener(walletProvider, hash => patch({ approveTxHash: hash })),
          });
          if (!approved.ok) throw approved.error;
          // Wait for the approval to be mined before the deposit simulates against the new allowance.
          const receipt = await walletProvider.waitForTransactionReceipt(approved.value as `0x${string}`);
          if (receipt.status === 'reverted' || receipt.status === '0x0') {
            throw new Error('The approval transaction failed on-chain. Check your gas balance and try again.');
          }
        }

        patch({ step: 'signing' });
        const result = await vaultSwap({
          ...payload,
          walletProvider: withTxListener(walletProvider, hash => patch({ step: 'processing', srcTxHash: hash })),
        });
        if (!result.ok) throw result.error;
        patch({ step: 'done', srcTxHash: result.value.intentDeliveryInfo.srcTxHash });
      }),
    [sodax, buildDeposit, approve, vaultSwap, patch, run],
  );

  return { state, deposit };
}
