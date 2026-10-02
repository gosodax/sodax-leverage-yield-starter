import {
  useLeverageYieldDeposit,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { IEvmWalletProvider, LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { flowErrorMessage } from '../lib/errors';
import { withTxListener } from '../lib/withTxListener';

export type FlowStep = 'idle' | 'preparing' | 'approving' | 'signing' | 'processing' | 'done' | 'error';

export type FlowState = {
  step: FlowStep;
  /** Whether this run needed an approval (only known after the allowance check). */
  needsApproval?: boolean;
  approveTxHash?: string;
  srcTxHash?: string;
  error?: string;
  failedStep?: FlowStep;
};

export type DepositArgs = {
  kind: 'deposit';
  vault: LeverageYieldVault;
  chainKey: SpokeChainKey;
  address: string;
  token: XToken;
  amount: bigint;
  minOut: bigint;
  walletProvider: IEvmWalletProvider;
};

export type WithdrawArgs = {
  kind: 'withdraw';
  vault: LeverageYieldVault;
  /** Network the shares are held under; the user signs there. */
  chainKey: SpokeChainKey;
  address: string;
  dstChainKey: SpokeChainKey;
  token: XToken;
  shares: bigint;
  minOut: bigint;
  walletProvider: IEvmWalletProvider;
};

/**
 * One deposit or withdraw, end to end, with the state the progress dialog renders.
 *
 * Deposit: build payload → approve the input token on the spoke asset manager if needed (waiting for the receipt)
 * → `vaultSwap` (sign intent, deliver to Sonic, solver fills). Withdraw: build payload (`hubWalletSwap`) →
 * `vaultSwap` (one signature authorising the hub wallet to spend its shares). Payloads are built at confirm time
 * because their deadline is hub block time + ~5 min.
 */
export function useVaultFlow() {
  const { sodax } = useSodaxContext();
  const queryClient = useQueryClient();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [state, setState] = useState<FlowState>({ step: 'idle' });
  const patch = useCallback((next: Partial<FlowState>) => setState(s => ({ ...s, ...next })), []);

  const run = useCallback(
    async (args: DepositArgs | WithdrawArgs, onSigned?: (srcTxHash: string) => void) => {
      setState({ step: 'preparing', needsApproval: args.kind === 'deposit' ? undefined : false });
      try {
        if (args.minOut <= 0n) throw new Error('Minimum received must be greater than 0.');

        const built =
          args.kind === 'deposit'
            ? await buildDeposit({
                vault: args.vault.vault,
                srcChainKey: args.chainKey,
                srcAddress: args.address,
                inputToken: args.token.address,
                inputAmount: args.amount,
                minOutputAmount: args.minOut,
              })
            : await buildWithdraw({
                vault: args.vault.vault,
                srcChainKey: args.chainKey,
                srcAddress: args.address,
                dstChainKey: args.dstChainKey,
                outputToken: args.token.address,
                inputAmount: args.shares,
                minOutputAmount: args.minOut,
              });
        if (!built.ok) throw built.error;
        const payload = built.value;

        if (args.kind === 'deposit') {
          const allowance = await sodax.swaps.isAllowanceValid({
            params: payload.params,
            raw: false,
            walletProvider: args.walletProvider,
          });
          if (!allowance.ok) throw allowance.error;
          patch({ needsApproval: !allowance.value });
          if (!allowance.value) {
            patch({ step: 'approving' });
            const approved = await approve({
              params: payload.params,
              walletProvider: withTxListener(args.walletProvider, hash => patch({ approveTxHash: hash })),
            });
            if (!approved.ok) throw approved.error;
            const receipt = await args.walletProvider.waitForTransactionReceipt(approved.value as `0x${string}`);
            if (receipt.status === 'reverted' || receipt.status === '0x0') {
              throw new Error('The approval failed on-chain. Check your gas balance and try again.');
            }
          }
        }

        patch({ step: 'signing' });
        const result = await vaultSwap({
          ...payload,
          walletProvider: withTxListener(args.walletProvider, hash => {
            patch({ step: 'processing', srcTxHash: hash });
            onSigned?.(hash);
          }),
        });
        if (!result.ok) throw result.error;
        patch({ step: 'done', srcTxHash: result.value.intentDeliveryInfo.srcTxHash });
        void queryClient.invalidateQueries({ queryKey: ['ly', 'shares'] });
        void queryClient.invalidateQueries({ queryKey: ['shared', 'balances'] });
      } catch (error) {
        setState(s => ({ ...s, step: 'error', failedStep: s.step, error: flowErrorMessage(error) }));
      }
    },
    [sodax, buildDeposit, buildWithdraw, approve, vaultSwap, patch, queryClient],
  );

  const reset = useCallback(() => setState({ step: 'idle' }), []);
  return { state, run, reset };
}
