import { useLeverageYieldQuote, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import { ChainKeys, type XToken } from '@sodax/types';
import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { AmountField } from './AmountField';
import { Field } from './Field';
import { errorMessage, SHARE_DECIMALS, underlyingLabel, useDebounced, useVaults } from './helpers';
import { defaultTokenFor, NetworkTokenFields } from './NetworkTokenFields';
import { OperationDialog } from './OperationDialog';
import { QuoteSummary } from './QuoteSummary';
import { RiskNotice } from './RiskNotice';
import { useVaultFlow } from './useVaultFlow';

type Props = { vaultName: string; onVaultChange: (name: string) => void };

/** Withdraw form: from the shares you hold (per network you deposited from), quote and withdraw to any token. */
export function WithdrawCard({ vaultName, onVaultChange }: Props) {
  const vaults = useVaults();
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const { address } = useEvmWallet();

  // Shares sit in the hub wallet derived from the network + address you deposited from, so check every network.
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const balanceQueries = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const holdings = balanceQueries.flatMap(q => (q.data && q.data.shares > 0n ? [q.data] : []));
  const loadingBalances = !!address && balanceQueries.some(q => q.isLoading);

  const [selectedChain, setSelectedChain] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const holding = holdings.find(h => h.chainKey === selectedChain) ?? holdings[0];
  const fromChain = (holding?.chainKey ?? selectedChain) as SourceChainKey;
  const shares = holding?.shares ?? 0n;

  const [toChain, setToChain] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [toToken, setToToken] = useState<XToken | undefined>(() => defaultTokenFor(DEFAULT_SOURCE_CHAIN));
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [open, setOpen] = useState(false);

  // You sign on the network that holds the shares.
  const wallet = useEvmWallet(fromChain);
  const flow = useVaultFlow();

  const debouncedAmount = useDebounced(amount);
  const typing = amount !== debouncedAmount;
  const parsed = parseTokenAmount(debouncedAmount, SHARE_DECIMALS);
  const sharesToBurn = parsed !== undefined && parsed <= shares ? parsed : undefined;
  const overBalance = parsed !== undefined && parsed > shares;

  // The vault is the source token, on Sonic.
  const quoteQuery = useLeverageYieldQuote({
    params: {
      payload:
        vault && toToken && sharesToBurn && sharesToBurn > 0n
          ? {
              token_src: vault.vault,
              token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
              token_dst: toToken.address,
              token_dst_blockchain_id: toChain,
              amount: sharesToBurn,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  const quote = quoteQuery.data;
  const quoted = quote?.ok ? quote.value.quoted_amount : undefined;
  const minOutputAmount = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const quoting = !!sharesToBurn && (typing || (quoteQuery.isFetching && !quote));
  const quoteError = quote && !quote.ok ? errorMessage(quote.error) : undefined;
  const ready =
    !typing &&
    !!vault &&
    !!toToken &&
    !!sharesToBurn &&
    quoted !== undefined &&
    minOutputAmount !== undefined &&
    minOutputAmount > 0n;

  const symbol = toToken?.symbol ?? '';
  const decimals = toToken?.decimals ?? 18;
  const receiveText = quoted !== undefined ? `≈ ${formatTokenAmount(quoted, decimals, 6)} ${symbol}` : '–';
  const minText = minOutputAmount !== undefined ? `${formatTokenAmount(minOutputAmount, decimals, 6)} ${symbol}` : '–';

  const start = () => {
    if (
      !vault ||
      !toToken ||
      !sharesToBurn ||
      minOutputAmount === undefined ||
      !wallet.address ||
      !wallet.walletProvider
    )
      return;
    void flow.run({
      direction: 'withdraw',
      walletProvider: wallet.walletProvider,
      params: {
        vault: vault.vault,
        srcChainKey: fromChain,
        srcAddress: wallet.address,
        dstChainKey: toChain,
        outputToken: toToken.address,
        inputAmount: sharesToBurn,
        minOutputAmount,
      },
    });
  };

  let action: { label: string; disabled: boolean; onClick: () => void };
  if (!wallet.isConnected) action = { label: 'Connect wallet', disabled: false, onClick: wallet.connect };
  else if (!holding) action = { label: 'No shares to withdraw', disabled: true, onClick: () => {} };
  else if (wallet.isWrongChain)
    action = { label: `Switch to ${chainName(fromChain)}`, disabled: false, onClick: wallet.switchChain };
  else if (!parsed || parsed === 0n) action = { label: 'Enter an amount', disabled: true, onClick: () => {} };
  else if (overBalance) action = { label: 'More than your shares', disabled: true, onClick: () => {} };
  else if (quoting) action = { label: 'Getting quote…', disabled: true, onClick: () => {} };
  else action = { label: 'Review withdrawal', disabled: !ready, onClick: () => setOpen(true) };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Vault">
        <Select
          value={vault?.name}
          onValueChange={name => {
            setAmount('');
            onVaultChange(name);
          }}
        >
          <SelectTrigger aria-label="Vault">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vaults.map(v => (
              <SelectItem key={v.name} value={v.name}>
                {v.name} · {underlyingLabel(v.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Your shares</span>
        {!wallet.isConnected ? (
          <p className="text-sm text-muted-foreground">Connect your wallet to see your shares.</p>
        ) : loadingBalances ? (
          <p className="text-sm text-muted-foreground">Checking your balances…</p>
        ) : holdings.length === 0 ? (
          <p className="text-sm text-muted-foreground">You don't hold any {vault?.name} yet. Deposit first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holdings.map(h => (
              <button
                key={h.chainKey}
                type="button"
                aria-pressed={h.chainKey === holding?.chainKey}
                onClick={() => {
                  setSelectedChain(h.chainKey as SourceChainKey);
                  setAmount('');
                }}
                className={cn(
                  'flex flex-col rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  h.chainKey === holding?.chainKey ? 'border-primary bg-secondary' : 'bg-card hover:bg-secondary',
                )}
              >
                <span className="font-semibold">{formatTokenAmount(h.shares, SHARE_DECIMALS, 6)}</span>
                <span className="text-xs text-muted-foreground">deposited from {chainName(h.chainKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AmountField
        label="Shares to withdraw"
        id="withdraw-amount"
        value={amount}
        onChange={setAmount}
        symbol={vault?.name ?? ''}
        disabled={!holding}
        error={overBalance ? "That's more than the shares you hold on this network." : undefined}
        trailing={
          <button
            type="button"
            disabled={!holding}
            onClick={() => setAmount(formatUnits(shares, SHARE_DECIMALS))}
            className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Max
          </button>
        }
      />

      <NetworkTokenFields
        chainKey={toChain}
        token={toToken}
        chainLabel="Receive on"
        tokenLabel="Receive as"
        onChange={(nextChain, nextToken) => {
          setToChain(nextChain);
          setToToken(nextToken);
        }}
      />

      <QuoteSummary
        receiveText={receiveText}
        minText={minText}
        loading={quoting}
        slippageBps={slippageBps}
        onSlippageChange={setSlippageBps}
      />

      {quoteError && !quoting && (
        <Callout variant="destructive">
          {quoteError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void quoteQuery.refetch()}>
            Retry
          </button>
        </Callout>
      )}

      <RiskNotice compact />

      <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
        {action.label}
      </Button>

      <OperationDialog
        open={open}
        onOpenChange={setOpen}
        title={`Withdraw from ${vault?.name}`}
        description="Check the numbers, then sign in your wallet."
        hasApprovalStep={false}
        deliveredLabel="Tokens delivered"
        confirmLabel="Confirm withdrawal"
        flow={flow}
        onConfirm={start}
        summary={[
          { label: 'You withdraw', value: `${formatTokenAmount(sharesToBurn, SHARE_DECIMALS, 6)} ${vault?.name}` },
          { label: 'You receive', value: `${receiveText} on ${chainName(toChain)}`, emphasis: true },
          { label: `Minimum (${formatBps(slippageBps)} slippage)`, value: minText },
          { label: 'You sign on', value: chainName(fromChain) },
        ]}
        warnings={
          <Callout>
            Withdrawing sells your shares through a solver at the quoted rate. If the vault's share price has fallen,
            you get back less than you deposited.
          </Callout>
        }
      />
    </div>
  );
}
