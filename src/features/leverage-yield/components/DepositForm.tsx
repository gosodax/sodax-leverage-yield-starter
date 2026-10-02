import { isNativeToken, type LeverageYieldVault } from '@sodax/types';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_SOURCE_CHAIN, isSourceChain, NATIVE_GAS_RESERVE, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { useDepositQuoteFor } from '../api/useTransportFlows';
import type { VaultStats } from '../api/useTransportReads';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { depositSteps } from '../lib/steps';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { SHARE_DECIMALS, shareValue } from '../lib/vaults';
import { ChainSelect } from './ChainSelect';
import { DepositReview, type DepositReviewInput } from './DepositReview';
import { ProjectedInterest } from './ProjectedInterest';
import { QuoteDetails } from './QuoteDetails';
import { QuoteError } from './QuoteError';
import { SidePanel } from './SidePanel';
import { TokenSelect } from './TokenSelect';

/** Deposit tab: pay with a token from any source network; "Review deposit" opens the review in place. */
export function DepositForm({
  vault,
  stats,
  prices,
  onBusyChange,
  onClose,
}: {
  vault: LeverageYieldVault;
  stats: VaultStats;
  prices: UsdPrices;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  // Source chain: the user's pick, else the wallet's current chain if allowed, else the default.
  const { currentChainKey } = useEvmWallet();
  const [pickedChain, setPickedChain] = useState<SourceChainKey>();
  const chainKey = pickedChain ?? (isSourceChain(currentChainKey) ? currentChainKey : DEFAULT_SOURCE_CHAIN);
  const wallet = useEvmWallet(chainKey);
  const { tokens, token, pickToken } = useTokenChoice(chainKey);

  const [amountText, setAmountText] = useState('');
  const inputAmount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const { balance, isLoading: balanceLoading } = useTokenBalance(chainKey, token, wallet.address);

  // Inputs the user is reviewing. While the review is open it quotes them itself, so the form stops quoting.
  const [review, setReview] = useState<DepositReviewInput | null>(null);
  const quote = useDepositQuoteFor({
    vault,
    srcChainKey: chainKey,
    token,
    inputAmount: review ? undefined : inputAmount,
  });

  const native = !!token && isNativeToken(chainKey, token);
  // Max leaves some of the native token for gas.
  const maxAmount = balance === undefined ? undefined : native ? balance - NATIVE_GAS_RESERVE[chainKey] : balance;

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (!amountText) return { label: 'Enter an amount', disabled: true };
    if (!inputAmount) return { label: 'Enter a valid amount', disabled: true };
    if (balance !== undefined && inputAmount > balance)
      return { label: `Insufficient ${token?.symbol}`, disabled: true };
    if (maxAmount !== undefined && native && inputAmount > maxAmount)
      return { label: `Leave some ${token?.symbol} for gas`, disabled: true };
    if (quote.isLoading) return { label: 'Getting quote…', disabled: true };
    if (!token || quote.error || quote.amountOut === undefined || quote.minAmountOut === undefined) {
      return { label: 'No quote', disabled: true };
    }
    const reviewed = { vault, token, chainKey, inputAmount };
    return { label: 'Review deposit', onClick: () => setReview(reviewed) };
  })();

  if (!token) return null;
  if (review) {
    return (
      <DepositReview
        review={review}
        stats={stats}
        prices={prices}
        onBack={() => setReview(null)}
        onBusyChange={onBusyChange}
        onClose={onClose}
      />
    );
  }

  const shares = inputAmount ? quote.amountOut : undefined;
  const amountUsd = formatUsd(toUsd(inputAmount, token.decimals, priceFor(prices, token.vault)));

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="rounded-lg bg-muted p-4 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring">
          <div className="flex items-center justify-between gap-2 text-sm">
            <label htmlFor="deposit-amount" className="shrink-0 font-medium">
              You deposit
            </label>
            {wallet.isConnected && (
              <span className="text-right text-muted-foreground">
                Balance:{' '}
                {balanceLoading ? (
                  <Skeleton className="inline-block h-3 w-12 bg-card align-middle" />
                ) : (
                  `${formatTokenAmount(balance, token.decimals)} ${token.symbol}`
                )}
                {maxAmount !== undefined && maxAmount > 0n && (
                  <button
                    type="button"
                    className="ml-2 font-semibold text-primary hover:underline"
                    onClick={() => setAmountText(formatUnits(maxAmount, token.decimals))}
                  >
                    Max
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <TokenSelect tokens={tokens} value={token.address} onChange={pickToken} pill />
            <Input
              id="deposit-amount"
              inputMode="decimal"
              placeholder="0"
              value={amountText}
              onChange={event => setAmountText(event.target.value)}
              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-3xl font-semibold focus-visible:ring-0"
            />
          </div>
          <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              on
              <ChainSelect value={chainKey} onChange={setPickedChain} label="From network" inline />
            </span>
            <span>{amountUsd}</span>
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm font-medium">You get</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            {inputAmount && quote.isLoading ? (
              <Skeleton className="h-9 w-28 bg-card" />
            ) : (
              <span className={cn('min-w-0 truncate text-3xl font-semibold', !shares && 'text-subtle-foreground')}>
                {shares !== undefined ? `≈ ${formatTokenAmount(shares, SHARE_DECIMALS)}` : '0'}
              </span>
            )}
            <span className="shrink-0 text-sm text-muted-foreground">vault shares</span>
          </div>
          {inputAmount && quote.error && (
            <div className="mt-3">
              <QuoteError message={quote.error} onRetry={quote.refetch} />
            </div>
          )}
          <div className="mt-3 border-t pt-3">
            <QuoteDetails
              vault={vault}
              stats={stats}
              prices={prices}
              shares={shares}
              minShares={inputAmount ? quote.minAmountOut : undefined}
            />
          </div>
        </div>

        <ProjectedInterest
          vault={vault}
          assets={shareValue(shares, stats.sharePrice.data)}
          aprRay={stats.apr.data?.effectiveNetAprRay}
          prices={prices}
        />

        <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Withdraw later from the same network you deposit from.
        </p>
      </div>

      <SidePanel vault={vault} stats={stats} prices={prices} steps={depositSteps({ vault, token, chainKey })} />
    </div>
  );
}
