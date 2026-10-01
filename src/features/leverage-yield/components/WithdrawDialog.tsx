import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { CheckCircle2Icon } from 'lucide-react';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_SLIPPAGE_BPS, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useFlowProgress } from '../hooks/useFlowProgress';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { useVaultWithdraw } from '../hooks/useVaultWithdraw';
import { useWithdrawQuote } from '../hooks/useWithdrawQuote';
import { SHARE_DECIMALS } from '../lib/vaults';
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

  const action = (() => {
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (!sharesText) return { label: 'Enter an amount', disabled: true };
    if (!shares) return { label: 'Enter a valid amount', disabled: true };
    if (shares > shareBalance) return { label: 'More than your shares', disabled: true };
    if (quote.isLoading) return { label: 'Getting quote…', disabled: true };
    if (quote.error || !quote.minAmountOut) return { label: 'No quote', disabled: true };
    return { label: 'Confirm withdrawal', onClick: confirm };
  })();

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent onInteractOutside={event => progress.busy && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{step === 'done' ? 'Withdrawal complete' : `Withdraw from ${vault.name}`}</DialogTitle>
          <DialogDescription>
            Shares held under {chainName(chainKey)}. You sign on {chainName(chainKey)}; funds arrive on the network you
            choose.
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
                  inputMode="decimal"
                  placeholder="0.00"
                  value={sharesText}
                  onChange={event => setSharesText(event.target.value)}
                  className="h-12 pr-20 text-lg"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSharesText(formatUnits(shareBalance, SHARE_DECIMALS))}
                >
                  Max
                </Button>
              </div>
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

            {shares && quote.error ? (
              <QuoteError message={quote.error} onRetry={quote.refetch} />
            ) : shares && quote.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : quote.amountOut !== undefined && quote.minAmountOut !== undefined && outputToken ? (
              <dl className="grid grid-cols-2 gap-y-2 rounded-md bg-secondary p-4 text-sm">
                <dt className="text-muted-foreground">You receive (est.)</dt>
                <dd className="text-right font-semibold">
                  {formatTokenAmount(quote.amountOut, outputToken.decimals)} {outputToken.symbol}
                </dd>
                <dt className="text-muted-foreground">Minimum received</dt>
                <dd className="text-right">
                  {formatTokenAmount(quote.minAmountOut, outputToken.decimals)} {outputToken.symbol}
                </dd>
                <dt className="text-muted-foreground">Max slippage</dt>
                <dd className="text-right">{formatBps(DEFAULT_SLIPPAGE_BPS)}</dd>
              </dl>
            ) : null}

            <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
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
                { label: 'Delivering to Sonic', status: progress.rows.deliver },
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
                <Callout>
                  Still processing after 5 minutes. It may yet complete: check the explorer link above. You can close
                  this window.
                </Callout>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keep this window open. This usually takes under two minutes.
                </p>
              ))}
            {step === 'error' && (
              <Callout variant="destructive">
                <p className="font-semibold">Withdrawal not completed</p>
                <p className="mt-1 break-words">{progress.error}</p>
              </Callout>
            )}
            {step === 'done' && (
              <Callout variant="success">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2Icon className="size-4" /> Withdrawn
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
