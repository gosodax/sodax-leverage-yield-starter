import { useBalances, useLeverageYieldDeposit } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import { useDebouncedValue } from '../hooks/useVaults';
import { isNativeToken, SHARE_DECIMALS } from '../lib/vaults';
import { FlowProgress } from './FlowProgress';
import { ChainSelect, Field, SlippagePicker, SummaryRow, TokenSelect } from './fields';
import { RiskNotice } from './RiskNotice';
import { VaultSelect } from './VaultSelect';

export function DepositForm({
  vaults,
  vault,
  onVaultChange,
}: {
  vaults: readonly LeverageYieldVault[];
  vault: LeverageYieldVault;
  onVaultChange: (name: string) => void;
}) {
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [tokenAddress, setTokenAddress] = useState(
    () => getTokenByKey(DEFAULT_SOURCE_CHAIN, DEFAULT_TOKEN_KEY)?.address ?? '',
  );
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const [amountText, setAmountText] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [acknowledged, setAcknowledged] = useState(false);

  const wallet = useEvmWallet(chainKey);
  const flow = useVaultFlow();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();

  const { data: balances } = useBalances({
    params: { chainKey, tokens, address: wallet.address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = token ? balances?.[token.address] : undefined;

  const amount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const debouncedAmount = useDebouncedValue(amount);
  const quotePayload =
    token && debouncedAmount && debouncedAmount > 0n
      ? {
          token_src: token.address,
          token_src_blockchain_id: chainKey,
          token_dst: vault.vault,
          token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
          amount: debouncedAmount,
          quote_type: 'exact_input' as const,
        }
      : undefined;
  const quote = useVaultQuote(quotePayload, slippageBps);

  const insufficient = amount !== undefined && balance !== undefined && amount > balance;
  const quoteIsCurrent = amount !== undefined && amount === debouncedAmount && !quote.isLoading;

  function onChainChange(next: SourceChainKey) {
    setChainKey(next);
    const sameSymbol = getDepositTokens(next).find(t => t.symbol === token?.symbol);
    setTokenAddress(sameSymbol?.address ?? getTokenByKey(next, DEFAULT_TOKEN_KEY)?.address ?? '');
  }

  function setMax() {
    if (!token || balance === undefined) return;
    const reserve = isNativeToken(token) ? NATIVE_GAS_RESERVE[chainKey] : 0n;
    const max = balance > reserve ? balance - reserve : 0n;
    setAmountText(formatTokenAmount(max, token.decimals, token.decimals).replace(/,/g, ''));
  }

  function submit() {
    if (!token || !wallet.address || !wallet.walletProvider || !amount || !quote.minOutput) return;
    const srcAddress = wallet.address;
    const minOutputAmount = quote.minOutput;
    void flow.run({
      srcChainKey: chainKey,
      walletProvider: wallet.walletProvider,
      checkApproval: true,
      build: () =>
        buildDeposit({
          vault: vault.vault,
          srcChainKey: chainKey,
          srcAddress,
          inputToken: token.address,
          inputAmount: amount,
          minOutputAmount,
        }),
    });
  }

  if (flow.state.phase !== 'idle') {
    return (
      <FlowProgress
        state={flow.state}
        kind="deposit"
        fillLabel={`Solver delivers ${vault.name} shares`}
        skipsRelay={flow.skipsRelay}
        onReset={() => {
          flow.reset();
          if (flow.state.phase === 'done') setAmountText('');
        }}
      />
    );
  }

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect, disabled: false };
    if (wallet.isWrongChain)
      return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain, disabled: false };
    if (!amount) return { label: 'Enter an amount', disabled: true };
    if (insufficient) return { label: `Insufficient ${token?.symbol}`, disabled: true };
    if (!quoteIsCurrent) return { label: 'Getting quote…', disabled: true };
    if (!quote.minOutput) return { label: 'No quote', disabled: true };
    if (!acknowledged) return { label: 'Accept the risks to deposit', disabled: true };
    return { label: `Deposit ${token?.symbol}`, onClick: submit, disabled: false };
  })();

  return (
    <div className="flex flex-col gap-4">
      <Field label="Vault">
        <VaultSelect vaults={vaults} value={vault.name} onChange={onVaultChange} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From network">
          <ChainSelect value={chainKey} options={SOURCE_CHAINS} onChange={k => onChainChange(k as SourceChainKey)} />
        </Field>
        <Field label="Token">
          <TokenSelect value={token?.address ?? ''} tokens={tokens} balances={balances} onChange={setTokenAddress} />
        </Field>
      </div>

      <Field
        label="Amount"
        hint={
          token && balance !== undefined ? (
            <button type="button" onClick={setMax} className="hover:text-primary">
              Balance {formatTokenAmount(balance, token.decimals)} {token.symbol} · <strong>Max</strong>
            </button>
          ) : undefined
        }
      >
        <Input
          inputMode="decimal"
          placeholder="5.00"
          value={amountText}
          onChange={e => setAmountText(e.target.value)}
          aria-invalid={insufficient}
          className="text-lg tabular-nums"
        />
      </Field>

      <SlippagePicker value={slippageBps} onChange={setSlippageBps} />

      <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
        <SummaryRow label="You receive (est.)" strong>
          {quote.quoted !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(quote.quoted, SHARE_DECIMALS)} ${vault.name}`
            : quote.isFetching
              ? 'Quoting…'
              : '–'}
        </SummaryRow>
        <SummaryRow label="Minimum accepted">
          {quote.minOutput !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(quote.minOutput, SHARE_DECIMALS)} ${vault.name}`
            : '–'}
        </SummaryRow>
        <SummaryRow label="Shares delivered to">SODAX hub wallet (Sonic)</SummaryRow>
        {quote.error && amount !== undefined && <p className="text-xs text-destructive">{quote.error}</p>}
      </div>

      <RiskNotice checked={acknowledged} onChange={setAcknowledged} />

      <Button size="lg" onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    </div>
  );
}
