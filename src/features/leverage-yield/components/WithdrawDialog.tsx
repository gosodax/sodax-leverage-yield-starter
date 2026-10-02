import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { CheckCircle2Icon } from 'lucide-react';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_SLIPPAGE_BPS, SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useFlowProgress } from '../hooks/useFlowProgress';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { useVaultHoldings } from '../hooks/useVaultHoldings';
import { useVaultWithdraw } from '../hooks/useVaultWithdraw';
import { useWithdrawQuote } from '../hooks/useWithdrawQuote';
import { formatShares, SHARE_DECIMALS, vaultTitle } from '../lib/vaults';
import { ChainSelect } from './ChainSelect';
import { QuoteError } from './QuoteError';
import { Stepper } from './Stepper';
import { TokenSelect } from './TokenSelect';
import { TxLink } from './TxLink';

/** M4: withdraw vault shares back to a token on a network of choice. Shares are held per source network. */
export function WithdrawDialog({
  vault,
  address,
  onClose,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  onClose: () => void;
}) {
  const holdings = useVaultHoldings(vault.vault, address);
  const heldChains = SOURCE_CHAINS.filter(chain => holdings.rows.some(row => row.chainKey === chain));

  const { currentChainKey } = useEvmWallet();
  const [pickedHeld, setPickedHeld] = useState<SourceChainKey>();
  const heldUnder: SourceChainKey =
    pickedHeld ?? heldChains.find(chain => chain === currentChainKey) ?? heldChains[0] ?? SOURCE_CHAINS[0];
  const holding = holdings.rows.find(row => row.chainKey === heldUnder);
  const shareBalance = holding?.shares ?? 0n;
  const wallet = useEvmWallet(heldUnder);

  const [pickedDst, setPickedDst] = useState<SourceChainKey>();
  const dstChainKey = pickedDst ?? heldUnder;
  const { tokens, token: outputToken, pickToken } = useTokenChoice(dstChainKey);

  const [sharesText, setSharesText] = useState('');
  const shares = parseTokenAmount(sharesText, SHARE_DECIMALS);
  const [confirmed, setConfirmed] = useState<{ amountOut: bigint; minAmountOut: bigint }>();

  const { state, withdraw } = useVaultWithdraw();
  const progress = useFlowProgress(state, heldUnder, false);
  const { step } = progress;
  const live = step === 'idle' || step === 'error';
  const quote = useWithdrawQuote({ vault, dstChainKey, outputToken, shares: live ? shares : undefined });

  const confirm = () => {
    if (!wallet.address || !wallet.walletProvider || !shares || !outputToken) return;
    if (quote.amountOut === undefined || !quote.minAmountOut || quote.isLoading || quote.error) return;
    setPickedHeld(heldUnder);
    setPickedDst(dstChainKey);
    setConfirmed({ amountOut: quote.amountOut, minAmountOut: quote.minAmountOut });
    void withdraw({
      vault,
      srcChainKey: heldUnder,
      srcAddress: wallet.address,
      dstChainKey,
      outputToken,
      shares,
      minAmountOut: quote.minAmountOut,
      walletProvider: wallet.walletProvider,
    });
  };

  const close = (open: boolean) => !open && !progress.busy && onClose();
  const isHub = heldUnder === ChainKeys.SONIC_MAINNET;
  const symbol = outputToken?.symbol ?? 'funds';
  const amountOut = live ? quote.amountOut : confirmed?.amountOut;
  const minAmountOut = live ? quote.minAmountOut : confirmed?.minAmountOut;
  const formatOut = (amount: bigint | undefined) =>
    outputToken && amount !== undefined ? `${formatTokenAmount(amount, outputToken.decimals)} ${symbol}` : '—';

  const action = ((): { label: string; onClick?: () => void; disabled?: boolean } => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (holdings.loading) return { label: 'Loading your shares…', disabled: true };
    if (heldChains.length === 0) return { label: 'No shares to withdraw', disabled: true };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(heldUnder)}`, onClick: wallet.switchChain };
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
          <DialogTitle>{step === 'done' ? 'Withdrawal complete' : `Withdraw from ${vaultTitle(vault)}`}</DialogTitle>
          <DialogDescription>
            {vault.name} on Sonic → {chainName(dstChainKey)}
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' ? (
          <div className="flex flex-col gap-4">
            {/* Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="withdraw-shares" className="font-medium">
                  You withdraw
                </label>
                {wallet.isConnected && !holdings.loading && (
                  <span className="text-muted-foreground">
                    Available: {formatTokenAmount(shareBalance, SHARE_DECIMALS)}
                    {shareBalance > 0n && (
                      <button
                        type="button"
                        className="ml-2 font-semibold text-primary hover:underline"
                        onClick={() => setSharesText(formatUnits(shareBalance, SHARE_DECIMALS))}
                      >
                        Max
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="withdraw-shares"
                  inputMode="decimal"
                  placeholder="0"
                  value={sharesText}
                  onChange={event => setSharesText(event.target.value)}
                  className="h-14 pr-24 text-xl"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">shares</span>
              </div>
              {heldChains.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Held under</span>
                  <Select value={heldUnder} onValueChange={value => setPickedHeld(value as SourceChainKey)}>
                    <SelectTrigger aria-label="Shares held under" className="h-9 w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {heldChains.map(chain => (
                        <SelectItem key={chain} value={chain}>
                          {chainName(chain)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Receive */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Receive on</span>
                <ChainSelect value={dstChainKey} onChange={setPickedDst} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">As token</span>
                {outputToken && <TokenSelect tokens={tokens} value={outputToken.address} onChange={pickToken} />}
              </div>
            </div>

            {shares && quote.error ? (
              <QuoteError message={quote.error} onRetry={quote.refetch} />
            ) : (
              <dl className="grid grid-cols-2 gap-y-2 rounded-md bg-secondary p-4 text-sm">
                <dt className="text-muted-foreground">You get (est.)</dt>
                <dd className="text-right font-semibold">
                  {shares && quote.isLoading ? <Skeleton className="ml-auto h-4 w-20" /> : `≈ ${formatOut(amountOut)}`}
                </dd>
                <dt className="text-muted-foreground">Minimum received</dt>
                <dd className="text-right">{shares ? formatOut(minAmountOut) : '—'}</dd>
                <dt className="text-muted-foreground">Max slippage</dt>
                <dd className="text-right">{formatBps(DEFAULT_SLIPPAGE_BPS)}</dd>
              </dl>
            )}

            <Callout>
              You'll sign one transaction on {chainName(heldUnder)} authorising your hub wallet to redeem the shares.
              Solvers then send {symbol} to your wallet on {chainName(dstChainKey)}, usually within a minute or two.
            </Callout>

            <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Stepper
              steps={[
                {
                  label: 'Confirm the withdrawal in your wallet',
                  status: progress.rows.sign,
                  detail: state.srcTxHash && <TxLink chainKey={heldUnder} hash={state.srcTxHash} />,
                },
                {
                  label: isHub ? 'Registering on Sonic' : `Delivering from ${chainName(heldUnder)} to Sonic`,
                  status: progress.rows.deliver,
                },
                {
                  label: `Solver sends ${symbol} to ${chainName(dstChainKey)}`,
                  status: progress.rows.fill,
                  detail: progress.fillTxHash && <TxLink chainKey={dstChainKey} hash={progress.fillTxHash} />,
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
                {state.srcTxHash && (
                  <p className="mt-1">Your transaction was sent. Check its status before retrying.</p>
                )}
              </Callout>
            )}

            {step === 'done' && (
              <Callout variant="success">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2Icon className="size-4" /> Withdrew {formatShares(shares)}
                </p>
                <p className="mt-1 text-foreground">
                  ≈ {formatOut(amountOut)} is on its way to your wallet on {chainName(dstChainKey)}.
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
                <Button className="flex-1" variant={step === 'done' ? 'default' : 'outline'} onClick={() => onClose()}>
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
