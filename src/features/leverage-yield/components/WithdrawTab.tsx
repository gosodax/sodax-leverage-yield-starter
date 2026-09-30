import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_SOURCE_CHAIN, type SourceChainKey } from '@/config/workshop';
import { chainName, explorerAddressUrl } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount, shortenAddress } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useWithdrawFlow, useWithdrawQuoteFor } from '../api/useTransportFlows';
import type { VaultStats } from '../api/useTransportReads';
import { useFlowProgress } from '../hooks/useFlowProgress';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { withdrawSteps } from '../lib/steps';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { formatShares, SHARE_DECIMALS, shareValue, underlying } from '../lib/vaults';
import { ChainSelect } from './ChainSelect';
import { FlowStatus } from './FlowStatus';
import { DetailRow } from './QuoteDetails';
import { QuoteError } from './QuoteError';
import { SidePanel } from './SidePanel';
import { TokenIcon } from './TokenIcon';
import { TokenSelect } from './TokenSelect';

/**
 * Withdraw tab: sell vault shares for a token on any source network. Shares are held per source network (one hub
 * wallet each), so the user picks which holding to sell and signs on that network. No approval step.
 */
export function WithdrawTab({
  vault,
  stats,
  prices,
  heldUnder: preselected,
  onBusyChange,
  onClose,
}: {
  vault: LeverageYieldVault;
  stats: VaultStats;
  prices: UsdPrices;
  /** Network to start on, e.g. the "Your vaults" line the user clicked. */
  heldUnder?: SourceChainKey;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const { currentChainKey } = useEvmWallet();
  const holdings = stats.holdings.data;
  const withShares = (holdings ?? []).filter(holding => holding.shares > 0n);
  const find = (chainKey: string | undefined) => withShares.find(holding => holding.chainKey === chainKey)?.chainKey;

  // The user's pick (fixed at confirm), else the network they came from, else the wallet's, else the first with shares.
  const [picked, setPicked] = useState<SourceChainKey>();
  const heldUnder =
    picked ??
    find(preselected) ??
    find(currentChainKey) ??
    withShares[0]?.chainKey ??
    preselected ??
    DEFAULT_SOURCE_CHAIN;
  const holding = holdings?.find(h => h.chainKey === heldUnder);
  const shareBalance = holding?.shares ?? 0n;
  const wallet = useEvmWallet(heldUnder);

  const [pickedDst, setPickedDst] = useState<SourceChainKey>();
  const dstChainKey = pickedDst ?? heldUnder;
  const { tokens, token: outputToken, pickToken } = useTokenChoice(dstChainKey);

  const [sharesText, setSharesText] = useState('');
  const shares = parseTokenAmount(sharesText, SHARE_DECIMALS);
  const [confirmed, setConfirmed] = useState<{ amountOut: bigint; minAmountOut: bigint }>();

  const { state, withdraw } = useWithdrawFlow();
  const progress = useFlowProgress(state, heldUnder, false);
  const { step } = progress;
  // Keep quoting after an error so "Try again" has a fresh minimum; stop once the user has confirmed.
  const live = step === 'idle' || step === 'error';
  const quote = useWithdrawQuoteFor({
    vault,
    srcChainKey: heldUnder,
    dstChainKey,
    outputToken,
    shares: live ? shares : undefined,
  });

  useEffect(() => {
    onBusyChange(progress.busy);
    return () => onBusyChange(false);
  }, [progress.busy, onBusyChange]);

  const confirm = () => {
    if (!wallet.address || !wallet.walletProvider || !shares || !outputToken) return;
    if (quote.amountOut === undefined || !quote.minAmountOut || quote.isLoading || quote.error) return;
    // Freeze the networks: after a full withdrawal the default holding would move to another network.
    setPicked(heldUnder);
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

  const action = ((): { label: string; onClick?: () => void; disabled?: boolean; hint?: string } => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (!holdings) {
      return { label: stats.holdings.isError ? "Couldn't load your shares" : 'Loading your shares…', disabled: true };
    }
    if (withShares.length === 0) {
      return { label: 'No shares to withdraw yet', disabled: true, hint: 'Deposit first to get vault shares.' };
    }
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(heldUnder)}`, onClick: wallet.switchChain };
    if (!sharesText) return { label: 'Enter an amount', disabled: true };
    if (!shares) return { label: 'Enter a valid amount', disabled: true };
    if (shares > shareBalance) return { label: 'More than your shares', disabled: true };
    if (quote.isLoading) return { label: 'Getting quote…', disabled: true };
    if (quote.error || !quote.minAmountOut) return { label: 'No quote', disabled: true };
    return { label: 'Confirm withdrawal', onClick: confirm };
  })();

  const asset = underlying(vault);
  const symbol = outputToken?.symbol ?? 'funds';
  const amountOut = live ? quote.amountOut : confirmed?.amountOut;
  const minAmountOut = live ? quote.minAmountOut : confirmed?.minAmountOut;
  const sharesUsd = formatUsd(
    toUsd(shareValue(shares, stats.sharePrice.data), asset.decimals, priceFor(prices, vault.asset)),
  );
  const outUsd = outputToken
    ? formatUsd(toUsd(shares ? amountOut : undefined, outputToken.decimals, priceFor(prices, outputToken.vault)))
    : '';
  const format = (amount: bigint | undefined) =>
    outputToken && amount !== undefined ? `${formatTokenAmount(amount, outputToken.decimals)} ${symbol}` : '—';

  const side = (
    <SidePanel
      vault={vault}
      stats={stats}
      prices={prices}
      steps={withdrawSteps({ heldUnder, dstChainKey, outputSymbol: symbol, progress, state })}
    />
  );

  if (step !== 'idle') {
    return (
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-3 font-semibold">{step === 'done' ? 'Withdrawal complete' : 'Your withdrawal'}</p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <DetailRow label="You withdraw">
                {formatShares(shares)} held under {chainName(heldUnder)}
              </DetailRow>
              <DetailRow label="You get">
                <span className="font-semibold">
                  ≈ {format(amountOut)} on {chainName(dstChainKey)}
                </span>
              </DetailRow>
              <DetailRow label="Minimum received">{format(minAmountOut)}</DetailRow>
            </dl>
          </div>

          <FlowStatus
            progress={progress}
            sent={!!state.srcTxHash}
            noun="Withdrawal"
            success={{
              title: 'Withdrawn',
              body: `${symbol} is on its way to your wallet on ${chainName(dstChainKey)}.`,
            }}
            onRetry={confirm}
            onClose={onClose}
          />
        </div>
        {side}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="rounded-lg bg-muted p-4 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring">
          <div className="flex items-center justify-between gap-2 text-sm">
            <label htmlFor="withdraw-shares" className="shrink-0 font-medium">
              You withdraw
            </label>
            {wallet.isConnected && holdings && (
              <span className="text-right text-muted-foreground">
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
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-card pr-4 pl-1.5 font-semibold">
              <TokenIcon symbol={asset.symbol} className="size-7" /> shares
            </span>
            <Input
              id="withdraw-shares"
              inputMode="decimal"
              placeholder="0"
              value={sharesText}
              disabled={withShares.length === 0}
              onChange={event => setSharesText(event.target.value)}
              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-3xl font-semibold focus-visible:ring-0"
            />
          </div>
          <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
            {withShares.length > 0 ? (
              <span className="flex items-center gap-1">
                held under
                <ChainSelect
                  value={heldUnder}
                  onChange={setPicked}
                  chains={withShares.map(h => h.chainKey)}
                  label="Shares held under"
                  inline
                />
              </span>
            ) : (
              <span />
            )}
            <span>{sharesUsd}</span>
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm font-medium">You get</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            {shares && quote.isLoading ? (
              <Skeleton className="h-9 w-28 bg-card" />
            ) : (
              <span className="min-w-0 truncate text-3xl font-semibold">
                {shares && amountOut !== undefined && outputToken ? (
                  `≈ ${formatTokenAmount(amountOut, outputToken.decimals)}`
                ) : (
                  <span className="text-subtle-foreground">0</span>
                )}
              </span>
            )}
            {outputToken && <TokenSelect tokens={tokens} value={outputToken.address} onChange={pickToken} pill />}
          </div>
          <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              on
              <ChainSelect value={dstChainKey} onChange={setPickedDst} label="Receive on network" inline />
            </span>
            <span>{outUsd}</span>
          </div>
          {shares && quote.error ? (
            <div className="mt-3">
              <QuoteError message={quote.error} onRetry={quote.refetch} />
            </div>
          ) : (
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-t pt-3 text-sm">
              <DetailRow label="Minimum received">{shares ? format(minAmountOut) : '—'}</DetailRow>
            </dl>
          )}
        </div>

        {holding && holding.shares > 0n && (
          <p className="text-xs text-muted-foreground">
            Held by your hub wallet{' '}
            <a
              href={explorerAddressUrl(ChainKeys.SONIC_MAINNET, holding.holder)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {shortenAddress(holding.holder)}
            </a>{' '}
            on Sonic. It won't show in your wallet app.
          </p>
        )}

        <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </Button>
        {action.hint && <p className="text-center text-xs text-muted-foreground">{action.hint}</p>}
      </div>
      {side}
    </div>
  );
}
