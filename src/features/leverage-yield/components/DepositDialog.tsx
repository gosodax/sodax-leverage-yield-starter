import { CheckCircleIcon } from '@phosphor-icons/react';
import { ChainKeys, isNativeToken, type LeverageYieldVault, type XToken } from '@sodax/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { InfoTip } from '@/components/ui/info-tip';
import { Reveal } from '@/components/ui/motion';
import { OrbPanel } from '@/components/ui/thinking-orb';
import type { SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useDepositQuote } from '../hooks/useDepositQuote';
import { useDoneToast } from '../hooks/useDoneToast';
import { useFlowProgress } from '../hooks/useFlowProgress';
import { useMarkPending } from '../hooks/useMarkPending';
import { useVaultDeposit } from '../hooks/useVaultDeposit';
import { vaultBrand } from '../lib/brands';
import { SHARE_DECIMALS } from '../lib/vaults';
import { QuoteDetails } from './QuoteDetails';
import { QuoteError } from './QuoteError';
import { Stepper } from './Stepper';
import { TxLink } from './TxLink';

/**
 * What the user is reviewing: inputs frozen when they clicked Review. The dialog quotes these exact inputs live and
 * captures the minimum when they click Confirm.
 */
export type DepositReview = {
  vault: LeverageYieldVault;
  token: XToken;
  chainKey: SourceChainKey;
  inputAmount: bigint;
};

export function DepositDialog({ review, onClose }: { review: DepositReview; onClose: (completed: boolean) => void }) {
  const { vault, token, chainKey, inputAmount } = review;
  const { address, walletProvider, isWrongChain, switchChain } = useEvmWallet(chainKey);
  const [confirmedShares, setConfirmedShares] = useState<bigint>();
  const { state, deposit } = useVaultDeposit();
  const progress = useFlowProgress(state, chainKey, !isNativeToken(chainKey, token));
  const { step } = progress;
  // Live quote for the frozen inputs, only while the user can (re)confirm; it stops once the flow starts.
  const quote = useDepositQuote({
    vault,
    srcChainKey: chainKey,
    token,
    inputAmount: step === 'idle' || step === 'error' ? inputAmount : undefined,
  });

  const confirm = () => {
    const minShares = quote.minAmountOut;
    if (!address || !walletProvider || minShares === undefined || quote.isLoading || quote.error) return;
    setConfirmedShares(quote.amountOut);
    void deposit({ vault, srcChainKey: chainKey, srcAddress: address, token, inputAmount, minShares, walletProvider });
  };

  // Keep the dialog open while a transaction is in flight.
  const close = (open: boolean) => !open && !progress.busy && onClose(step === 'done');
  const isHub = chainKey === ChainKeys.SONIC_MAINNET;

  useMarkPending(vault.name, progress.busy);

  useDoneToast(
    step === 'done',
    `Deposited into ${vaultBrand(vault).name}`,
    <>
      {state.srcTxHash && <TxLink chainKey={chainKey} hash={state.srcTxHash} />}
      {progress.hubTxHash && !isHub && <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.hubTxHash} />}
      {progress.fillTxHash && <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.fillTxHash} />}
    </>,
  );

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent onInteractOutside={event => progress.busy && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{step === 'done' ? 'Deposit complete' : 'Review deposit'}</DialogTitle>
          <DialogDescription>
            {chainName(chainKey)} → {vaultBrand(vault).name} on Sonic
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' ? (
          <>
            <Reveal id={quote.error ? 'error' : quote.amountOut !== undefined ? 'quote' : 'loading'}>
              {quote.error ? (
                <QuoteError message={quote.error} onRetry={quote.refetch} />
              ) : quote.amountOut !== undefined && quote.minAmountOut !== undefined ? (
                <QuoteDetails
                  vault={vault}
                  token={token}
                  inputAmount={inputAmount}
                  shares={quote.amountOut}
                  minShares={quote.minAmountOut}
                />
              ) : (
                <OrbPanel className="h-32">Getting a live quote</OrbPanel>
              )}
            </Reveal>
            <Callout className="flex items-center gap-1">
              You sign {isNativeToken(chainKey, token) ? 'one transaction' : 'up to two transactions'} on{' '}
              {chainName(chainKey)}.
              <InfoTip label="What happens next">
                After you sign, solvers fill the deposit, usually within a minute or two, and your shares arrive in your
                own SODAX hub wallet on Sonic.
              </InfoTip>
            </Callout>
            {isWrongChain ? (
              <Button size="lg" onClick={switchChain}>
                Switch to {chainName(chainKey)}
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={!walletProvider || quote.minAmountOut === undefined || quote.isLoading || !!quote.error}
                busy={quote.isLoading}
                onClick={confirm}
              >
                Confirm deposit
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <Stepper
              steps={[
                {
                  label: `Approve ${token.symbol}`,
                  status: progress.rows.approve,
                  detail: state.approveTxHash && <TxLink chainKey={chainKey} hash={state.approveTxHash} />,
                },
                {
                  label: 'Confirm the deposit in your wallet',
                  status: progress.rows.sign,
                  detail: state.srcTxHash && <TxLink chainKey={chainKey} hash={state.srcTxHash} />,
                },
                {
                  label:
                    progress.rows.deliver === 'done'
                      ? 'Delivered on Sonic'
                      : isHub
                        ? 'Registering on Sonic'
                        : `Delivering from ${chainName(chainKey)} to Sonic`,
                  status: progress.rows.deliver,
                  detail: progress.hubTxHash && <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.hubTxHash} />,
                },
                {
                  label: 'Solver fills; shares arrive in your hub wallet',
                  status: progress.rows.fill,
                  detail: progress.fillTxHash && (
                    <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.fillTxHash} />
                  ),
                },
              ]}
            />

            {step === 'processing' &&
              (progress.timedOut ? (
                <Callout>Still processing after 5 minutes. Check the explorer link above; you can close this.</Callout>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keep this window open. This usually takes under two minutes.
                </p>
              ))}

            {step === 'error' && (
              <Callout variant="destructive">
                <p className="font-semibold">Deposit not completed</p>
                {state.srcTxHash && (
                  <p className="mt-1">Your transaction was sent. Check its status before retrying.</p>
                )}
                <Disclosure className="mt-1">
                  <p className="break-words">{progress.error}</p>
                </Disclosure>
              </Callout>
            )}

            {step === 'done' && (
              <Callout variant="success">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircleIcon weight="duotone" className="size-4" /> Deposited{' '}
                  {formatTokenAmount(inputAmount, token.decimals)} {token.symbol}
                </p>
                <p className="mt-1 flex items-center gap-1 text-foreground">
                  ≈ {formatTokenAmount(confirmedShares, SHARE_DECIMALS)} {vaultBrand(vault).name} shares are now in your
                  hub wallet.
                  <InfoTip label="About your hub wallet">
                    Your shares sit in your own SODAX hub wallet on Sonic, which only your wallet controls. They won't
                    appear in your wallet app; your position on this page shows them.
                  </InfoTip>
                </p>
              </Callout>
            )}

            {(step === 'done' || step === 'error' || progress.timedOut) && (
              <div className="flex gap-2">
                {step === 'error' && !state.srcTxHash && (
                  <Button className="flex-1" onClick={confirm}>
                    Try again
                  </Button>
                )}
                <Button
                  className="flex-1"
                  variant={step === 'done' ? 'default' : 'outline'}
                  onClick={() => close(false)}
                >
                  {step === 'done' ? 'Done' : 'Close'}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
