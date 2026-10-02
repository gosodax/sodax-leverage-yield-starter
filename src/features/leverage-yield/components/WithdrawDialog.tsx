import { CheckCircleIcon } from '@phosphor-icons/react';
import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Flash, Reveal } from '@/components/ui/motion';
import { OrbPanel } from '@/components/ui/thinking-orb';
import { DEFAULT_SLIPPAGE_BPS, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useDoneToast } from '../hooks/useDoneToast';
import { useFlowProgress } from '../hooks/useFlowProgress';
import { useMarkPending } from '../hooks/useMarkPending';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { useVaultWithdraw } from '../hooks/useVaultWithdraw';
import { useWithdrawQuote } from '../hooks/useWithdrawQuote';
import { vaultBrand } from '../lib/brands';
import { SHARE_DECIMALS } from '../lib/vaults';
import { AmountChips } from './AmountChips';
import { ChainSelect } from './ChainSelect';
import { QuoteError } from './QuoteError';
import { Stepper } from './Stepper';
import { TokenSelect } from './TokenSelect';
import { TxLink } from './TxLink';

type Props = {
  vault: LeverageYieldVault;
  /** Chain the shares are held under; the user signs the withdrawal here. */
  chainKey: SourceChainKey;
  shareBalance: bigint;
  onClose: () => void;
};

export function WithdrawDialog({ vault, chainKey, shareBalance, onClose }: Props) {
  const wallet = useEvmWallet(chainKey);
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(chainKey);
  const { tokens, token: outputToken, pickToken } = useTokenChoice(dstChainKey);

  const [sharesText, setSharesText] = useState('');
  const sharesRef = useRef<HTMLInputElement>(null);
  const shares = parseTokenAmount(sharesText, SHARE_DECIMALS);

  const { state, withdraw } = useVaultWithdraw();
  const progress = useFlowProgress(state, chainKey, false);
  const { step } = progress;
  // Stop quoting once the user has confirmed; the minimum is already captured.
  const quote = useWithdrawQuote({ vault, dstChainKey, outputToken, shares: step === 'idle' ? shares : undefined });

  const confirm = () => {
    if (!wallet.address || !wallet.walletProvider || !shares || !quote.minAmountOut || !outputToken) return;
    void withdraw({
      vault,
      srcChainKey: chainKey,
      srcAddress: wallet.address,
      dstChainKey,
      outputToken,
      shares,
      minAmountOut: quote.minAmountOut,
      walletProvider: wallet.walletProvider,
    });
  };

  const close = (open: boolean) => !open && !progress.busy && onClose();

  useMarkPending(vault.name, progress.busy);

  useDoneToast(
    step === 'done',
    `Withdrawn from ${vaultBrand(vault).name}`,
    <>
      {state.srcTxHash && <TxLink chainKey={chainKey} hash={state.srcTxHash} />}
      {progress.hubTxHash && chainKey !== ChainKeys.SONIC_MAINNET && (
        <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.hubTxHash} />
      )}
      {progress.fillTxHash && <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.fillTxHash} />}
    </>,
  );

  const action = (() => {
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (!sharesText) return { label: 'Enter an amount', disabled: true };
    if (!shares) return { label: 'Enter a valid amount', disabled: true };
    if (shares > shareBalance) return { label: 'More than your shares', disabled: true };
    if (quote.isLoading) return { label: 'Getting quote…', disabled: true, busy: true };
    if (quote.error || !quote.minAmountOut) return { label: 'No quote', disabled: true };
    return { label: 'Confirm withdrawal', onClick: confirm };
  })();

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent onInteractOutside={event => progress.busy && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 'done' ? 'Withdrawal complete' : `Withdraw from ${vaultBrand(vault).name}`}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            You sign on {chainName(chainKey)}
            <InfoTip label="How a withdrawal works">
              These shares belong to deposits from {chainName(chainKey)}, so you sign there. Solvers then deliver the
              token you pick to the network you choose.
            </InfoTip>
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="withdraw-shares" className="font-medium">
                  Shares
                </label>
                <span className="text-muted-foreground">
                  Available: {formatTokenAmount(shareBalance, SHARE_DECIMALS)}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="withdraw-shares"
                  ref={sharesRef}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={sharesText}
                  onChange={event => setSharesText(event.target.value)}
                  className="h-12 text-lg"
                />
              </div>
              <AmountChips
                base={shareBalance}
                maxRatio={1}
                decimals={SHARE_DECIMALS}
                value={sharesText}
                onFill={setSharesText}
                inputRef={sharesRef}
                disabledReason={shareBalance === 0n ? 'No shares to withdraw' : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Receive on</span>
                <ChainSelect value={dstChainKey} onChange={setDstChainKey} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Receive</span>
                {outputToken && <TokenSelect tokens={tokens} value={outputToken.address} onChange={pickToken} />}
              </div>
            </div>

            <Reveal
              id={
                shares && quote.error
                  ? 'error'
                  : shares && quote.isLoading
                    ? 'loading'
                    : quote.amountOut !== undefined && quote.minAmountOut !== undefined && outputToken
                      ? 'quote'
                      : false
              }
            >
              {shares && quote.error ? (
                <QuoteError message={quote.error} onRetry={quote.refetch} />
              ) : shares && quote.isLoading ? (
                <OrbPanel className="h-24">Getting a live quote</OrbPanel>
              ) : quote.amountOut !== undefined && quote.minAmountOut !== undefined && outputToken ? (
                <dl className="grid grid-cols-2 gap-y-2 rounded-md bg-secondary p-4 text-sm">
                  <dt className="text-muted-foreground">You receive (est.)</dt>
                  <dd className="text-right font-semibold">
                    <Flash
                      value={`${formatTokenAmount(quote.amountOut, outputToken.decimals)} ${outputToken.symbol}`}
                    />
                  </dd>
                  <dt className="text-muted-foreground">Minimum received</dt>
                  <dd className="text-right">
                    <Flash
                      value={`${formatTokenAmount(quote.minAmountOut, outputToken.decimals)} ${outputToken.symbol}`}
                    />
                  </dd>
                  <dt className="text-muted-foreground">Max slippage</dt>
                  <dd className="text-right">{formatBps(DEFAULT_SLIPPAGE_BPS)}</dd>
                </dl>
              ) : null}
            </Reveal>

            <Button size="lg" disabled={action.disabled} busy={action.busy} onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Stepper
              steps={[
                {
                  label: `Authorise the withdrawal in your wallet (${chainName(chainKey)})`,
                  status: progress.rows.sign,
                  detail: state.srcTxHash && <TxLink chainKey={chainKey} hash={state.srcTxHash} />,
                },
                {
                  label: progress.rows.deliver === 'done' ? 'Delivered on Sonic' : 'Delivering to Sonic',
                  status: progress.rows.deliver,
                  detail: progress.hubTxHash && <TxLink chainKey={ChainKeys.SONIC_MAINNET} hash={progress.hubTxHash} />,
                },
                {
                  label: `Solver sends ${outputToken?.symbol ?? 'funds'} to ${chainName(dstChainKey)}`,
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
                <p className="font-semibold">Withdrawal not completed</p>
                <Disclosure className="mt-1">
                  <p className="break-words">{progress.error}</p>
                </Disclosure>
              </Callout>
            )}
            {step === 'done' && (
              <Callout variant="success">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircleIcon weight="duotone" className="size-4" /> Withdrawn
                </p>
                <p className="mt-1 text-foreground">
                  {outputToken?.symbol} is on its way to your wallet on {chainName(dstChainKey)}.
                </p>
              </Callout>
            )}
            {(step === 'done' || step === 'error' || progress.timedOut) && (
              <Button variant={step === 'done' ? 'default' : 'outline'} onClick={() => close(false)}>
                {step === 'done' ? 'Done' : 'Close'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
