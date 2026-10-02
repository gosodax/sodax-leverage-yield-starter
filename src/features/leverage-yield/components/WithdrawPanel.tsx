import type { LeverageYieldVault } from '@sodax/types';
import { ArrowUpFromLineIcon, PiggyBankIcon, WalletIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import type { Activity } from '../hooks/useActivity';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import type { Holding, VaultStats } from '../hooks/useVaults';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { formatShares, SHARE_DECIMALS, shareValue, underlying } from '../lib/vaults';
import { AmountInput } from './AmountInput';
import { formatPlain, SLIPPAGE_OPTIONS } from './DepositPanel';
import { FlowDialog } from './FlowDialog';
import { ChainSelect, FieldLabel, TokenSelect } from './Pickers';
import { HIGH_COST, QuoteBox, valueRetained } from './QuoteBox';
import { Segmented } from './Segmented';
import { TokenIcon } from './TokenIcon';

export type HoldingKey = { vaultName: string; chainKey: SourceChainKey };

const keyOf = (h: { vaultName: string; chainKey: string }) => `${h.vaultName}|${h.chainKey}`;

export function WithdrawPanel({
  holdings,
  loaded,
  selected,
  onSelect,
  statsOf,
  prices,
  onActivity,
  onBrowse,
}: {
  holdings: Holding[];
  loaded: boolean;
  selected: HoldingKey | undefined;
  onSelect: (key: HoldingKey) => void;
  statsOf: (vault: LeverageYieldVault) => VaultStats | undefined;
  prices: UsdPrices;
  onActivity: (item: Omit<Activity, 'id' | 'at'>) => void;
  onBrowse: () => void;
}) {
  const holding =
    holdings.find(h => selected && h.vault.name === selected.vaultName && h.chainKey === selected.chainKey) ??
    holdings[0];
  const vault = holding?.vault;
  const signChain = holding?.chainKey ?? SOURCE_CHAINS[0];
  const wallet = useEvmWallet(signChain);
  const flow = useVaultFlow();

  // Smart default: pay out on the network the shares came from, in USDC.
  const [dstChain, setDstChain] = useState<SourceChainKey>(signChain);
  useEffect(() => setDstChain(signChain), [signChain]);
  const tokens = useMemo(() => getDepositTokens(dstChain), [dstChain]);
  const [tokenAddr, setTokenAddr] = useState<string>();
  const token = tokens.find(t => t.address === tokenAddr) ?? getTokenByKey(dstChain, DEFAULT_TOKEN_KEY) ?? tokens[0];

  const [sharesText, setSharesText] = useState('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [open, setOpen] = useState(false);
  // Switching position clears the amount (adjust state during render, not in an effect).
  const holdingId = holding ? `${holding.vault.name}|${holding.chainKey}` : '';
  const [lastHolding, setLastHolding] = useState(holdingId);
  if (lastHolding !== holdingId) {
    setLastHolding(holdingId);
    setSharesText('');
  }

  const stats = vault ? statsOf(vault) : undefined;
  const asset = vault ? underlying(vault) : undefined;
  const shares = parseTokenAmount(sharesText, SHARE_DECIMALS);
  const quote = useVaultQuote({ direction: 'withdraw', vault, chainKey: dstChain, token, amount: shares }, slippage);

  const inValue = shareValue(shares, stats?.sharePrice.data);
  const inUsd = toUsd(inValue, asset?.decimals ?? 18, vault ? priceFor(prices, vault.asset) : undefined);
  const outUsd = toUsd(quote.amountOut, token?.decimals ?? 18, priceFor(prices, token?.vault));
  const retained = valueRetained(inUsd, outUsd);
  const cost = retained !== undefined ? 1 - retained : undefined;

  if (!wallet.isConnected) {
    return (
      <Empty
        icon={<WalletIcon className="size-6" />}
        title="Connect to see your shares"
        action={<Button onClick={wallet.connect}>Connect wallet</Button>}
      />
    );
  }
  if (!holding) {
    return (
      <Empty
        icon={<PiggyBankIcon className="size-6" />}
        title={loaded ? 'No shares to withdraw yet' : 'Looking for your shares…'}
        action={
          loaded && (
            <Button variant="outline" onClick={onBrowse}>
              Make a deposit
            </Button>
          )
        }
      />
    );
  }

  const fill = (num: bigint, den: bigint) => setSharesText(formatPlain((holding.shares * num) / den, SHARE_DECIMALS));
  const all = shares === holding.shares;

  const action = (() => {
    if (!shares || shares <= 0n) return { label: 'Enter shares to withdraw', disabled: true };
    if (shares > holding.shares) return { label: 'More than you hold', disabled: true };
    if (quote.error) return { label: 'No quote available', disabled: true };
    if (quote.isLoading || quote.minAmountOut === undefined) return { label: 'Finding best route…', disabled: true };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(signChain)}`, onClick: wallet.switchChain };
    return {
      label: 'Review withdraw',
      onClick: () => {
        flow.reset();
        setOpen(true);
      },
    };
  })();

  const summary = `${formatShares(shares)} → ≈ ${formatTokenAmount(quote.amountOut, token?.decimals ?? 18)} ${token?.symbol} on ${chainName(dstChain)}`;

  const confirm = () => {
    if (!vault || !token || !shares || !quote.minAmountOut || !wallet.walletProvider || !wallet.address) return;
    void flow.run(
      {
        kind: 'withdraw',
        vault,
        chainKey: signChain,
        address: wallet.address,
        dstChainKey: dstChain,
        token,
        shares,
        minOut: quote.minAmountOut,
        walletProvider: wallet.walletProvider,
      },
      srcTxHash =>
        onActivity({
          kind: 'withdraw',
          vaultName: vault.name,
          summary,
          chainKey: signChain,
          srcTxHash,
          status: 'pending',
        }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Position</FieldLabel>
        <Select
          value={keyOf({ vaultName: holding.vault.name, chainKey: holding.chainKey })}
          onValueChange={value => {
            const [vaultName, chainKey] = value.split('|');
            onSelect({ vaultName, chainKey: chainKey as SourceChainKey });
          }}
        >
          <SelectTrigger aria-label="Position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {holdings.map(h => (
              <SelectItem
                key={keyOf({ vaultName: h.vault.name, chainKey: h.chainKey })}
                value={keyOf({ vaultName: h.vault.name, chainKey: h.chainKey })}
              >
                <TokenIcon symbol={underlying(h.vault).symbol} chainKey={h.chainKey} className="size-5" />
                {underlying(h.vault).symbol} Vault · {chainName(h.chainKey)}
                <span className="ml-auto pl-3 font-mono text-xs text-muted-foreground">{formatShares(h.shares)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel hint={`You hold ${formatShares(holding.shares)}`}>Shares to withdraw</FieldLabel>
        <AmountInput
          ariaLabel="Shares to withdraw"
          value={sharesText}
          onChange={setSharesText}
          invalid={shares !== undefined && shares > holding.shares}
          usd={formatUsd(inUsd)}
          suffix={
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{holding.vault.name}</span>
          }
          chips={[
            { label: '25%', onClick: () => fill(1n, 4n) },
            { label: '50%', onClick: () => fill(1n, 2n) },
            { label: '75%', onClick: () => fill(3n, 4n) },
            { label: 'All', onClick: () => fill(1n, 1n) },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Receive on</FieldLabel>
          <ChainSelect
            chains={SOURCE_CHAINS}
            value={dstChain}
            onChange={next => {
              setDstChain(next);
              setTokenAddr(getDepositTokens(next).find(t => t.symbol === token?.symbol)?.address);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Token</FieldLabel>
          <TokenSelect tokens={tokens} value={token?.address} onChange={setTokenAddr} />
        </div>
      </div>

      {shares !== undefined && shares > 0n && token && (
        <QuoteBox
          quote={quote}
          retained={retained}
          receive={
            <>
              {formatTokenAmount(quote.amountOut, token.decimals)} {token.symbol}
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{formatUsd(outUsd)}</span>
            </>
          }
          minimum={`${formatTokenAmount(quote.minAmountOut, token.decimals)} ${token.symbol}`}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Max slippage</span>
        <Segmented size="sm" label="Max slippage" value={slippage} options={SLIPPAGE_OPTIONS} onChange={setSlippage} />
      </div>

      <p className="text-xs text-muted-foreground">
        You sign once on {chainName(signChain)} (where these shares were deposited from). No approval needed.
      </p>

      <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
        <ArrowUpFromLineIcon />
        {action.label}
      </Button>

      {vault && token && (
        <FlowDialog
          open={open}
          onOpenChange={setOpen}
          kind="withdraw"
          title={`Withdrawing from ${asset?.symbol} Vault`}
          chainKey={signChain}
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
              kind: 'withdraw',
              vaultName: vault.name,
              summary,
              chainKey: signChain,
              srcTxHash: flow.state.srcTxHash,
              status,
            })
          }
          successText={`${token.symbol} is on its way to your wallet on ${chainName(dstChain)}.`}
          review={[
            { label: 'You withdraw', value: `${formatShares(shares)}${all ? ' (all)' : ''}`, strong: true },
            { label: 'From', value: `${asset?.symbol} Vault via ${chainName(signChain)}` },
            {
              label: 'You receive',
              value: `≈ ${formatTokenAmount(quote.amountOut, token.decimals)} ${token.symbol} on ${chainName(dstChain)}`,
              strong: true,
            },
            {
              label: 'Minimum received',
              value: `${formatTokenAmount(quote.minAmountOut, token.decimals)} ${token.symbol}`,
            },
            { label: 'Max slippage', value: `${slippage / 100}%` },
          ]}
        />
      )}
    </div>
  );
}

function Empty({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {action}
    </div>
  );
}
