import type { LeverageYieldVault, XToken } from '@sodax/types';
import { SparklesIcon, WalletIcon, ZapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatRayPercent, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import type { Activity } from '../hooks/useActivity';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import type { VaultStats } from '../hooks/useVaults';
import type { WalletAsset } from '../hooks/useWalletAssets';
import { spendableOf } from '../hooks/useWalletAssets';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { aprFraction, formatShares, shareValue, underlying } from '../lib/vaults';
import { AmountInput } from './AmountInput';
import { FlowDialog } from './FlowDialog';
import { ChainSelect, FieldLabel, TokenSelect, VaultSelect } from './Pickers';
import { HIGH_COST, QuoteBox, valueRetained, WARN_COST } from './QuoteBox';
import { Segmented } from './Segmented';
import { TokenIcon } from './TokenIcon';

export const SLIPPAGE_OPTIONS = [
  { value: 50, label: '0.5%' },
  { value: 100, label: '1%' },
  { value: 300, label: '3%' },
] as const;

const MIN_DEPOSIT_USD = 2;

export function DepositPanel({
  vaults,
  vaultName,
  onVaultChange,
  stats,
  prices,
  assets,
  balanceOf,
  onActivity,
}: {
  vaults: readonly LeverageYieldVault[];
  vaultName: string;
  onVaultChange: (name: string) => void;
  stats: VaultStats | undefined;
  prices: UsdPrices;
  assets: WalletAsset[];
  balanceOf: (chainKey: SourceChainKey, token: XToken | undefined) => bigint | undefined;
  onActivity: (item: Omit<Activity, 'id' | 'at'> & { at?: number }) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName);
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [tokenAddr, setTokenAddr] = useState(() => getTokenByKey(DEFAULT_SOURCE_CHAIN, DEFAULT_TOKEN_KEY)?.address);
  const token = tokens.find(t => t.address === tokenAddr) ?? tokens[0];
  const [amountText, setAmountText] = useState('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [open, setOpen] = useState(false);

  const wallet = useEvmWallet(chainKey);
  const flow = useVaultFlow();

  const amount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const balance = balanceOf(chainKey, token);
  const spendable = token && balance !== undefined ? spendableOf(chainKey, token, balance) : undefined;
  const tokenPrice = priceFor(prices, token?.vault);
  const inUsd = toUsd(amount, token?.decimals ?? 18, tokenPrice);

  const quote = useVaultQuote({ direction: 'deposit', vault, chainKey, token, amount }, slippage);
  const asset = vault ? underlying(vault) : undefined;
  const outValue = shareValue(quote.amountOut, stats?.sharePrice.data);
  const outUsd = toUsd(outValue, asset?.decimals ?? 18, vault ? priceFor(prices, vault.asset) : undefined);
  const retained = valueRetained(inUsd, outUsd);
  const cost = retained !== undefined ? 1 - retained : undefined;
  const apr = stats?.apr.data?.netAprRay;
  const yearly = outUsd !== undefined && apr !== undefined ? outUsd * (aprFraction(apr) ?? 0) : undefined;

  // A new amount or route needs a fresh acknowledgement.
  const routeKey = `${amountText}|${tokenAddr}|${chainKey}|${vaultName}`;
  const [ackedRoute, setAckedRoute] = useState<string>();
  const ackHighCost = ackedRoute === routeKey;
  const setAckHighCost = (on: boolean) => setAckedRoute(on ? routeKey : undefined);

  const selectAsset = (asset: WalletAsset, fill = true) => {
    setChainKey(asset.chainKey);
    setTokenAddr(asset.token.address);
    if (fill) setAmountText(formatPlain(asset.spendable, asset.token.decimals));
  };

  const fillFraction = (num: bigint, den: bigint) => {
    if (spendable === undefined || !token) return;
    setAmountText(formatPlain((spendable * num) / den, token.decimals));
  };

  // Smart suggestion: when this selection can't cover the amount, find a holding that can.
  const better =
    inUsd !== undefined && spendable !== undefined && amount !== undefined && amount > spendable
      ? assets.find(a => (a.usd ?? 0) >= inUsd && !(a.chainKey === chainKey && a.token.address === token?.address))
      : undefined;

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect, icon: <WalletIcon /> };
    if (!vault) return { label: 'Choose a vault', disabled: true };
    if (!amount || amount <= 0n) return { label: 'Enter an amount', disabled: true };
    if (balance !== undefined && amount > balance) return { label: `Not enough ${token?.symbol}`, disabled: true };
    if (spendable !== undefined && amount > spendable) return { label: 'Leave some for gas', disabled: true };
    if (inUsd !== undefined && inUsd < MIN_DEPOSIT_USD)
      return { label: `Minimum ~$${MIN_DEPOSIT_USD}`, disabled: true };
    if (quote.error) return { label: 'No quote available', disabled: true };
    if (quote.isLoading || quote.minAmountOut === undefined) return { label: 'Finding best route…', disabled: true };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (cost !== undefined && cost > HIGH_COST && !ackHighCost)
      return { label: 'Acknowledge the cost', disabled: true };
    return {
      label: 'Review deposit',
      icon: <ZapIcon />,
      onClick: () => {
        flow.reset();
        setOpen(true);
      },
    };
  })();

  const confirm = () => {
    if (!vault || !token || !amount || !quote.minAmountOut || !wallet.walletProvider || !wallet.address) return;
    const summary = `${amountText} ${token.symbol} on ${chainName(chainKey)} → ≈ ${formatShares(quote.amountOut)}`;
    void flow.run(
      {
        kind: 'deposit',
        vault,
        chainKey,
        address: wallet.address,
        token,
        amount,
        minOut: quote.minAmountOut,
        walletProvider: wallet.walletProvider,
      },
      srcTxHash =>
        onActivity({ kind: 'deposit', vaultName: vault.name, summary, chainKey, srcTxHash, status: 'pending' }),
    );
  };

  const suggestions = assets.slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          hint={apr !== undefined && <span className="font-semibold text-primary">{formatRayPercent(apr)} APR</span>}
        >
          Vault
        </FieldLabel>
        <VaultSelect vaults={vaults} value={vaultName} onChange={onVaultChange} />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>
            <span className="inline-flex items-center gap-1">
              <SparklesIcon className="size-3" /> Fund from your wallet
            </span>
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(asset => {
              const active = asset.chainKey === chainKey && asset.token.address === token?.address;
              return (
                <button
                  key={`${asset.chainKey}-${asset.token.address}`}
                  type="button"
                  onClick={() => selectAsset(asset)}
                  className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs transition-colors hover:bg-secondary ${active ? 'border-primary bg-secondary' : 'bg-card'}`}
                >
                  <TokenIcon symbol={asset.token.symbol} chainKey={asset.chainKey} className="size-6" />
                  <span className="font-semibold">
                    {formatTokenAmount(asset.spendable, asset.token.decimals, 2)} {asset.token.symbol}
                  </span>
                  {asset.usd !== undefined && <span className="text-muted-foreground">{formatUsd(asset.usd)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>From</FieldLabel>
          <ChainSelect
            chains={SOURCE_CHAINS}
            value={chainKey}
            onChange={next => {
              setChainKey(next);
              const sameSymbol = getDepositTokens(next).find(t => t.symbol === token?.symbol);
              setTokenAddr((sameSymbol ?? getTokenByKey(next, DEFAULT_TOKEN_KEY))?.address);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Token</FieldLabel>
          <TokenSelect
            tokens={tokens}
            value={token?.address}
            onChange={setTokenAddr}
            balanceOf={t => balanceOf(chainKey, t)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel
          hint={
            token &&
            balance !== undefined && (
              <>
                Balance {formatTokenAmount(balance, token.decimals)} {token.symbol}
              </>
            )
          }
        >
          Amount
        </FieldLabel>
        <AmountInput
          ariaLabel="Deposit amount"
          value={amountText}
          onChange={setAmountText}
          invalid={amount !== undefined && balance !== undefined && amount > balance}
          usd={formatUsd(inUsd)}
          suffix={
            token && (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-3 pl-1 text-sm font-semibold">
                <TokenIcon symbol={token.symbol} chainKey={chainKey} className="size-6" />
                {token.symbol}
              </span>
            )
          }
          chips={
            wallet.isConnected
              ? [
                  { label: '25%', onClick: () => fillFraction(1n, 4n), disabled: !spendable },
                  { label: '50%', onClick: () => fillFraction(1n, 2n), disabled: !spendable },
                  { label: 'Max', onClick: () => fillFraction(1n, 1n), disabled: !spendable },
                ]
              : undefined
          }
        />
        {better && (
          <button
            type="button"
            onClick={() => selectAsset(better, false)}
            className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-left text-xs text-secondary-foreground hover:bg-muted"
          >
            <SparklesIcon className="size-3.5 shrink-0" />
            You hold {formatTokenAmount(better.spendable, better.token.decimals, 2)} {better.token.symbol} on{' '}
            {chainName(better.chainKey)} ({formatUsd(better.usd)}). Pay with that instead →
          </button>
        )}
      </div>

      {amount !== undefined && amount > 0n && vault && asset && (
        <QuoteBox
          quote={quote}
          retained={retained}
          receive={
            <>
              {formatShares(quote.amountOut)}
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                ≈ {formatUsd(outUsd) || `${formatTokenAmount(outValue, asset.decimals)} ${asset.symbol}`}
              </span>
            </>
          }
          minimum={formatShares(quote.minAmountOut)}
          extra={
            yearly !== undefined && (
              <div className="mt-1 grid grid-cols-2 gap-2 border-t pt-3">
                <Projection label="Est. per month" value={yearly / 12} />
                <Projection label="Est. per year" value={yearly} />
              </div>
            )
          }
        />
      )}

      {cost !== undefined && cost > WARN_COST && (
        <Callout variant={cost > HIGH_COST ? 'destructive' : 'notice'} className="flex flex-col gap-2">
          <span>
            This route costs about {(cost * 100).toFixed(1)}% of your deposit. Small amounts and cross-network routes
            cost more; try a larger amount or a token closer to {asset?.symbol}.
          </span>
          {cost > HIGH_COST && (
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={ackHighCost} onChange={e => setAckHighCost(e.target.checked)} />I
              understand and want to continue
            </label>
          )}
        </Callout>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Max slippage</span>
        <Segmented size="sm" label="Max slippage" value={slippage} options={SLIPPAGE_OPTIONS} onChange={setSlippage} />
      </div>

      <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
        {action.icon}
        {action.label}
      </Button>

      {vault && token && (
        <FlowDialog
          open={open}
          onOpenChange={setOpen}
          kind="deposit"
          title={`Depositing into ${asset?.symbol} Vault`}
          chainKey={chainKey}
          state={flow.state}
          onConfirm={confirm}
          warning={
            cost !== undefined && cost > HIGH_COST
              ? `You lose about ${(cost * 100).toFixed(1)}% to fees and routing.`
              : undefined
          }
          onPhase={status =>
            flow.state.srcTxHash &&
            onActivity({
              kind: 'deposit',
              vaultName: vault.name,
              summary: `${amountText} ${token.symbol} on ${chainName(chainKey)} → ≈ ${formatShares(quote.amountOut)}`,
              chainKey,
              srcTxHash: flow.state.srcTxHash,
              status,
            })
          }
          successText={`Your ${asset?.symbol} Vault shares are in your SODAX hub wallet on Sonic.`}
          review={[
            { label: 'You pay', value: `${amountText} ${token.symbol} on ${chainName(chainKey)}`, strong: true },
            { label: 'Vault', value: `${asset?.symbol} Vault (${vault.name})` },
            {
              label: 'You receive',
              value: `≈ ${formatShares(quote.amountOut)}${outUsd !== undefined ? ` (${formatUsd(outUsd)})` : ''}`,
              strong: true,
            },
            { label: 'Minimum received', value: formatShares(quote.minAmountOut) },
            { label: 'Max slippage', value: `${slippage / 100}%` },
            { label: 'Net APR', value: apr !== undefined ? formatRayPercent(apr) : '–' },
          ]}
        />
      )}
    </div>
  );
}

function Projection({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-semibold ${value < 0 ? 'text-destructive' : 'text-success'}`}>
        {value >= 0 ? '+' : ''}
        {formatUsd(value)}
      </p>
    </div>
  );
}

/** bigint → plain decimal string for the input (no thousands separators), trimmed to 6 fraction digits, rounding down. */
export function formatPlain(amount: bigint, decimals: number): string {
  const s = amount.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = s
    .slice(s.length - decimals)
    .slice(0, 6)
    .replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
