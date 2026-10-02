import { isUserRejectedError, useLeverageYieldVaultSwap, useSwapApprove } from '@sodax/dapp-kit';
import { type IntentDeliveryInfo, isSodaxError, type LeverageYieldSwapPayload } from '@sodax/sdk';
import type { IEvmWalletProvider, Result } from '@sodax/types';
import { useState } from 'react';
import { isHex } from 'viem';
import { type FillStatus, type TrackedTx, useFillStatus } from './useFillStatus';

/**
 * - `signing`: the wallet is asking for the intent signature.
 * - `delivering`: the intent tx is on the source chain; SODAX is relaying it to Sonic.
 * - `submitted`: delivered and the solver notified; following it to the fill.
 * - `unknown`: something failed after the intent may have been broadcast. Never retried, so a retry can't sign a
 *   second deposit; followed from the source tx when we have its hash.
 */
export type FlowPhase = 'ready' | 'approving' | 'signing' | 'delivering' | 'submitted' | 'unknown' | 'error';

export type VaultFlow = {
  phase: FlowPhase;
  approveTxHash: string | undefined;
  /** The approval is mined and succeeded in this flow. */
  approved: boolean;
  /** The intent tx on the source chain, known as soon as the wallet broadcasts it. */
  srcTx: TrackedTx | undefined;
  /** Full delivery info, once `vaultSwap` resolves. */
  delivery: IntentDeliveryInfo | undefined;
  fill: FillStatus;
  error: string | undefined;
  /** True while the wallet may be prompting: the dialog must not close mid-signature. */
  busy: boolean;
  run: (args: {
    payload: LeverageYieldSwapPayload;
    walletProvider: IEvmWalletProvider;
    needsApproval: boolean;
    /** Rebuilds the payload right before signing, so a slow approval doesn't leave a stale deadline. */
    rebuild?: () => Promise<Result<LeverageYieldSwapPayload>>;
  }) => Promise<void>;
};

/** Codes the SDK returns before anything is broadcast, so trying again is safe. */
const PRE_BROADCAST_CODES = new Set(['USER_REJECTED', 'VALIDATION_FAILED', 'INTENT_CREATION_FAILED']);

export function flowErrorMessage(error: unknown): string {
  if (isSodaxError(error) && error.code === 'INTENT_CREATION_FAILED') {
    return `The transaction would fail on Sonic (simulation reverted), so nothing was sent. Check your balance and gas on the source network. ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Forwards everything to the wallet provider, and reports the hash of the transaction it broadcasts. */
function withBroadcastHook(walletProvider: IEvmWalletProvider, onHash: (hash: string) => void): IEvmWalletProvider {
  return new Proxy(walletProvider, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop === 'sendTransaction' && typeof value === 'function') {
        return async (...args: Parameters<IEvmWalletProvider['sendTransaction']>) => {
          const hash = await target.sendTransaction(...args);
          onHash(hash);
          return hash;
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Runs a built vault swap: approve the spoke token when needed (deposits only), sign and submit the intent, then
 * follow it to the fill. A wallet rejection returns to `ready` quietly.
 */
export function useVaultFlow(srcChainKey: TrackedTx['srcChainKey']): VaultFlow {
  const [phase, setPhase] = useState<FlowPhase>('ready');
  const [approveTxHash, setApproveTxHash] = useState<string>();
  const [approved, setApproved] = useState(false);
  const [srcTx, setSrcTx] = useState<TrackedTx>();
  const [delivery, setDelivery] = useState<IntentDeliveryInfo>();
  const [error, setError] = useState<string>();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const fill = useFillStatus(srcTx);

  const fail = (context: string, cause: unknown) => {
    console.error(`[leverage-yield] ${context} failed`, cause);
    setError(flowErrorMessage(cause));
    setPhase('error');
  };

  const run: VaultFlow['run'] = async ({ payload, walletProvider, needsApproval, rebuild }) => {
    setError(undefined);

    if (needsApproval) {
      setPhase('approving');
      const approval = await approve({ params: payload.params, walletProvider });
      if (!approval.ok) {
        if (isUserRejectedError(approval.error)) return setPhase('ready');
        return fail('approve', approval.error);
      }
      const approveHash = approval.value;
      if (!isHex(approveHash)) return fail('approve', new Error(`Unexpected approval result: ${String(approveHash)}`));
      setApproveTxHash(approveHash);
      // The deposit spends this allowance next, so the approval must be mined and must not have reverted.
      try {
        const receipt = await walletProvider.waitForTransactionReceipt(approveHash);
        if (receipt.status === 'reverted' || receipt.status === '0x0') {
          return fail('approve', new Error('The approval transaction reverted.'));
        }
      } catch (cause) {
        console.error('[leverage-yield] approval receipt failed', cause);
        setError(
          'The approval was sent but is not confirmed yet. Wait for it in the explorer, then try again: the app re-checks the allowance first.',
        );
        return setPhase('error');
      }
      setApproved(true);
    }

    let toSign = payload;
    if (rebuild) {
      const rebuilt = await rebuild();
      if (!rebuilt.ok) return fail('rebuild', rebuilt.error);
      toSign = rebuilt.value;
    }

    const sent: { hash?: string } = {};
    const tracked = withBroadcastHook(walletProvider, hash => {
      sent.hash = hash;
      setSrcTx({ srcChainKey, srcTxHash: hash });
      setPhase('delivering');
    });

    setPhase('signing');
    const result = await vaultSwap({ ...toSign, walletProvider: tracked });
    if (!result.ok) {
      const code = isSodaxError(result.error) ? result.error.code : undefined;
      if (!sent.hash && code && PRE_BROADCAST_CODES.has(code)) {
        if (isUserRejectedError(result.error)) return setPhase('ready');
        return fail('vault swap', result.error);
      }
      // The intent may be on-chain: never offer a retry. The fill status keeps following the source tx.
      console.error('[leverage-yield] vault swap failed after signing', result.error);
      setError(
        sent.hash
          ? `Your transaction is on-chain, but the app lost track of its delivery (${flowErrorMessage(result.error)}). Don't send it again: the status below keeps checking, and your position updates once it fills.`
          : `Something failed after signing (${flowErrorMessage(result.error)}). Don't send it again: check your wallet's activity and your position in a few minutes.`,
      );
      return setPhase('unknown');
    }
    const info = result.value.intentDeliveryInfo;
    if (info.srcTxHash !== sent.hash) setSrcTx({ srcChainKey: info.srcChainKey, srcTxHash: info.srcTxHash });
    setDelivery(result.value.intentDeliveryInfo);
    setPhase('submitted');
  };

  return {
    phase,
    approveTxHash,
    approved,
    srcTx,
    delivery,
    fill,
    error,
    busy: phase === 'approving' || phase === 'signing',
    run,
  };
}
