import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { ChainKeys, type XToken } from '@sodax/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_SLIPPAGE_BPS, DEFAULT_SOURCE_CHAIN, REFETCH_MS, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
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

/** Deposit form: pick a vault, a network and a token, enter an amount, see a live quote, then confirm in a dialog. */
export function DepositCard({ vaultName, onVaultChange }: Props) {
  const vaults = useVaults();
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];

  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [token, setToken] = useState<XToken | undefined>(() => defaultTokenFor(DEFAULT_SOURCE_CHAIN));
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [open, setOpen] = useState(false);

  const wallet = useEvmWallet(chainKey);
  const flow = useVaultFlow();

  const debouncedAmount = useDebounced(amount);
  const inputAmount = token ? parseTokenAmount(debouncedAmount, token.decimals) : undefined;
  const typing = amount !== debouncedAmount;

  // The vault is the destination token, always on Sonic. Quote with the leverage-yield quote, never the swap quote.
  const quoteQuery = useLeverageYieldQuote({
    params: {
      payload:
        vault && token && inputAmount && inputAmount > 0n
          ? {
              token_src: token.address,
              token_src_blockchain_id: chainKey,
              token_dst: vault.vault,
              token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
              amount: inputAmount,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });

  const quote = quoteQuery.data;
  const quoted = quote?.ok ? quote.value.quoted_amount : undefined;
  const minOutputAmount = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const quoting = !!inputAmount && (typing || (quoteQuery.isFetching && !quote));
  const quoteError = quote && !quote.ok ? errorMessage(quote.error) : undefined;
  const ready =
    !typing &&
    !!vault &&
    !!token &&
    !!inputAmount &&
    quoted !== undefined &&
    minOutputAmount !== undefined &&
    minOutputAmount > 0n;

  const invalidAmount = amount.trim() !== '' && token && parseTokenAmount(amount, token.decimals) === undefined;

  const start = () => {
    if (!vault || !token || !inputAmount || minOutputAmount === undefined || !wallet.address || !wallet.walletProvider)
      return;
    void flow.run({
      direction: 'deposit',
      walletProvider: wallet.walletProvider,
      params: {
        vault: vault.vault,
        srcChainKey: chainKey,
        srcAddress: wallet.address,
        inputToken: token.address,
        inputAmount,
        minOutputAmount,
      },
    });
  };

  let action: { label: string; disabled: boolean; onClick: () => void };
  if (!wallet.isConnected) action = { label: 'Connect wallet', disabled: false, onClick: wallet.connect };
  else if (wallet.isWrongChain)
    action = { label: `Switch to ${chainName(chainKey)}`, disabled: false, onClick: wallet.switchChain };
  else if (!inputAmount) action = { label: 'Enter an amount', disabled: true, onClick: () => {} };
  else if (quoting) action = { label: 'Getting quote…', disabled: true, onClick: () => {} };
  else action = { label: 'Review deposit', disabled: !ready, onClick: () => setOpen(true) };

  const symbol = token?.symbol ?? '';
  const receiveText = quoted !== undefined ? `≈ ${formatTokenAmount(quoted, SHARE_DECIMALS)} ${vault?.name}` : '–';
  const minText =
    minOutputAmount !== undefined ? `${formatTokenAmount(minOutputAmount, SHARE_DECIMALS)} ${vault?.name}` : '–';

  return (
    <div className="flex flex-col gap-4">
      <Field label="Vault">
        <Select value={vault?.name} onValueChange={onVaultChange}>
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

      <NetworkTokenFields
        chainKey={chainKey}
        token={token}
        chainLabel="From network"
        tokenLabel="Pay with"
        onChange={(nextChain, nextToken) => {
          setChainKey(nextChain);
          setToken(nextToken);
        }}
      />

      <AmountField
        label="Amount"
        id="deposit-amount"
        value={amount}
        onChange={setAmount}
        symbol={symbol}
        error={invalidAmount ? `Enter a number with at most ${token?.decimals} decimals.` : undefined}
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
        title={`Deposit into ${vault?.name}`}
        description="Check the numbers, then sign in your wallet."
        hasApprovalStep
        deliveredLabel="Shares delivered to your hub wallet"
        confirmLabel="Confirm deposit"
        flow={flow}
        onConfirm={start}
        summary={[
          {
            label: 'You deposit',
            value: `${formatTokenAmount(inputAmount, token?.decimals ?? 18, 6)} ${symbol} on ${chainName(chainKey)}`,
          },
          { label: 'You receive', value: receiveText, emphasis: true },
          { label: `Minimum (${formatBps(slippageBps)} slippage)`, value: minText },
          { label: 'Shares are held in', value: 'Your hub wallet on Sonic' },
        ]}
        warnings={<RiskNotice />}
      />
    </div>
  );
}
