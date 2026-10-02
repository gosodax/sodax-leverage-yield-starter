import { useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type SpokeChainKey } from '@sodax/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  isSourceChain,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import { useDebouncedValue, useVaultShares } from '../hooks/useVaults';
import { SHARE_DECIMALS } from '../lib/vaults';
import { FlowProgress } from './FlowProgress';
import { ChainSelect, Field, SlippagePicker, SummaryRow, TokenSelect } from './fields';
import { RiskNotice } from './RiskNotice';
import { VaultSelect } from './VaultSelect';

/**
 * Withdraw shares back to a token on any supported network. Shares are held per source network (one hub wallet
 * each), so the user picks which position to redeem from and signs on that network.
 */
export function WithdrawForm({
  vaults,
  vault,
  onVaultChange,
}: {
  vaults: readonly LeverageYieldVault[];
  vault: LeverageYieldVault;
  onVaultChange: (name: string) => void;
}) {
  const connected = useEvmWallet();
  const shares = useVaultShares(vault, connected.address);
  const positions = shares.holdings.filter(h => h.shares > 0n && isSourceChain(h.chainKey));

  const [fromChain, setFromChain] = useState<SourceChainKey | undefined>();
  const position = positions.find(p => p.chainKey === fromChain) ?? positions[0];
  const signChain = (position?.chainKey ?? SOURCE_CHAINS[0]) as SourceChainKey;
  const wallet = useEvmWallet(signChain);

  // Destination defaults to wherever the position came from; the token choice is kept by symbol across networks.
  const [dstChoice, setDstChoice] = useState<SourceChainKey | undefined>();
  const dstChain = dstChoice ?? signChain;
  const tokens = useMemo(() => getDepositTokens(dstChain), [dstChain]);
  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>();
  const token =
    tokens.find(t => t.symbol === tokenSymbol) ??
    tokens.find(t => t.address === getTokenByKey(dstChain, DEFAULT_TOKEN_KEY)?.address) ??
    tokens[0];

  const [amountText, setAmountText] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [acknowledged, setAcknowledged] = useState(false);
  const flow = useVaultFlow();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();

  const amount = parseTokenAmount(amountText, SHARE_DECIMALS);
  const debouncedAmount = useDebouncedValue(amount);
  const quotePayload =
    token && debouncedAmount && debouncedAmount > 0n
      ? {
          token_src: vault.vault,
          token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
          token_dst: token.address,
          token_dst_blockchain_id: dstChain,
          amount: debouncedAmount,
          quote_type: 'exact_input' as const,
        }
      : undefined;
  const quote = useVaultQuote(quotePayload, slippageBps);

  const tooMuch = amount !== undefined && position !== undefined && amount > position.shares;
  const quoteIsCurrent = amount !== undefined && amount === debouncedAmount && !quote.isLoading;

  function submit() {
    if (!token || !wallet.address || !wallet.walletProvider || !amount || !quote.minOutput) return;
    const srcAddress = wallet.address;
    const minOutputAmount = quote.minOutput;
    void flow.run({
      srcChainKey: signChain,
      walletProvider: wallet.walletProvider,
      checkApproval: false,
      build: () =>
        buildWithdraw({
          vault: vault.vault,
          srcChainKey: signChain,
          srcAddress,
          dstChainKey: dstChain,
          outputToken: token.address,
          inputAmount: amount,
          minOutputAmount,
        }),
    });
  }

  if (flow.state.phase !== 'idle') {
    return (
      <FlowProgress
        state={flow.state}
        kind="withdraw"
        fillLabel={`Solver sends ${token?.symbol ?? 'tokens'} on ${chainName(dstChain)}`}
        skipsRelay={flow.skipsRelay}
        onReset={() => {
          flow.reset();
          if (flow.state.phase === 'done') setAmountText('');
        }}
      />
    );
  }

  const header = (
    <Field label="Vault">
      <VaultSelect vaults={vaults} value={vault.name} onChange={onVaultChange} />
    </Field>
  );

  if (!connected.isConnected) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Button size="lg" onClick={connected.connect}>
          Connect wallet
        </Button>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Callout>
          {shares.isLoading ? 'Looking up your shares…' : `You have no ${vault.name} shares yet. Deposit first.`}
        </Callout>
      </div>
    );
  }

  const action = (() => {
    if (wallet.isWrongChain)
      return { label: `Switch to ${chainName(signChain)}`, onClick: wallet.switchChain, disabled: false };
    if (!amount) return { label: 'Enter an amount', disabled: true };
    if (tooMuch) return { label: `Not enough ${vault.name}`, disabled: true };
    if (!quoteIsCurrent) return { label: 'Getting quote…', disabled: true };
    if (!quote.minOutput) return { label: 'No quote', disabled: true };
    if (!acknowledged) return { label: 'Accept the risks to withdraw', disabled: true };
    return { label: `Withdraw to ${token?.symbol}`, onClick: submit, disabled: false };
  })();

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Field label="Position (deposited from)">
        <ChainSelect
          value={position.chainKey}
          options={positions.map(p => p.chainKey) as SpokeChainKey[]}
          onChange={k => setFromChain(k as SourceChainKey)}
        />
      </Field>

      <Field
        label="Shares to withdraw"
        hint={
          <button
            type="button"
            className="hover:text-primary"
            onClick={() =>
              setAmountText(formatTokenAmount(position.shares, SHARE_DECIMALS, SHARE_DECIMALS).replace(/,/g, ''))
            }
          >
            Available {formatTokenAmount(position.shares, SHARE_DECIMALS)} · <strong>Max</strong>
          </button>
        }
      >
        <Input
          inputMode="decimal"
          placeholder="0.00"
          value={amountText}
          onChange={e => setAmountText(e.target.value)}
          aria-invalid={tooMuch}
          className="text-lg tabular-nums"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Receive on">
          <ChainSelect value={dstChain} options={SOURCE_CHAINS} onChange={k => setDstChoice(k as SourceChainKey)} />
        </Field>
        <Field label="Token">
          <TokenSelect
            value={token?.address ?? ''}
            tokens={tokens}
            onChange={address => setTokenSymbol(tokens.find(t => t.address === address)?.symbol)}
          />
        </Field>
      </div>

      <SlippagePicker value={slippageBps} onChange={setSlippageBps} />

      <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
        <SummaryRow label="You receive (est.)" strong>
          {token && quote.quoted !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(quote.quoted, token.decimals)} ${token.symbol}`
            : quote.isFetching
              ? 'Quoting…'
              : '–'}
        </SummaryRow>
        <SummaryRow label="Minimum accepted">
          {token && quote.minOutput !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(quote.minOutput, token.decimals)} ${token.symbol}`
            : '–'}
        </SummaryRow>
        <SummaryRow label="Sent to">
          {wallet.address ? `Your wallet on ${chainName(dstChain)}` : chainName(dstChain)}
        </SummaryRow>
        {quote.error && amount !== undefined && <p className="text-xs text-destructive">{quote.error}</p>}
      </div>

      <RiskNotice checked={acknowledged} onChange={setAcknowledged} />

      <Button size="lg" onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    </div>
  );
}
