import { useBalances, useQuote, useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys, type SpokeChainKey } from '@sodax/types';
import { ArrowDownUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Window } from '@/components/desktop/Window';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
} from '@/config/workshop';
import { FlowProgress } from '@/features/leverage-yield/components/FlowProgress';
import {
  ChainLabel,
  Field,
  SlippagePicker,
  SummaryRow,
  TokenSelect,
} from '@/features/leverage-yield/components/fields';
import { useVaultFlow } from '@/features/leverage-yield/hooks/useVaultFlow';
import { useDebouncedValue } from '@/features/leverage-yield/hooks/useVaults';
import { quoteErrorMessage } from '@/features/leverage-yield/lib/errors';
import { isNativeToken } from '@/features/leverage-yield/lib/vaults';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';

/** The swap page serves Base only: both sides of every swap are on Base. */
const SWAP_CHAIN = ChainKeys.BASE_MAINNET;
const SWAP_TOKENS = getDepositTokens(SWAP_CHAIN);

/** Swap intents expire this long after the hub block they were built against. */
const SWAP_DEADLINE_SECONDS = 300n;

/** Pick a token on `chainKey` by symbol, falling back to the default token, then to the first one listed. */
function pickToken(chainKey: SpokeChainKey, symbol: string | undefined) {
  const tokens = getDepositTokens(chainKey);
  return (
    tokens.find(t => t.symbol === symbol) ??
    tokens.find(t => t.address === getTokenByKey(chainKey, DEFAULT_TOKEN_KEY)?.address) ??
    tokens[0]
  );
}

/** Cross-chain swaps between the workshop networks, filled by SODAX solvers. */
export function SwapPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="font-display text-lg text-primary">Swap</h2>
        <p className="text-sm text-muted-foreground">
          Swap tokens on Base. Solvers fill the intent at or above your minimum.
        </p>
      </div>
      <Window id="swap" title="swap.exe" bodyClassName="gap-4 p-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Network</span>
          <ChainLabel chainKey={SWAP_CHAIN} />
        </div>
        <SwapForm />
      </Window>
    </div>
  );
}

function SwapForm() {
  const { sodax } = useSodaxContext();
  const srcChain = SWAP_CHAIN;
  const dstChain = SWAP_CHAIN;
  const [srcSymbol, setSrcSymbol] = useState<string | undefined>('USDC');
  const [dstSymbol, setDstSymbol] = useState<string | undefined>('ETH');
  const srcTokens = SWAP_TOKENS;
  const dstTokens = SWAP_TOKENS;
  const srcToken = pickToken(srcChain, srcSymbol);
  const dstToken = pickToken(dstChain, dstSymbol);

  const [amountText, setAmountText] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [acknowledged, setAcknowledged] = useState(false);

  const wallet = useEvmWallet(srcChain);
  const flow = useVaultFlow('swap');

  const { data: balances } = useBalances({
    params: { chainKey: srcChain, tokens: srcTokens, address: wallet.address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = srcToken ? balances?.[srcToken.address] : undefined;

  const amount = srcToken ? parseTokenAmount(amountText, srcToken.decimals) : undefined;
  const debouncedAmount = useDebouncedValue(amount);
  const sameToken = srcToken?.address === dstToken?.address;
  const quotePayload =
    srcToken && dstToken && !sameToken && debouncedAmount && debouncedAmount > 0n
      ? {
          token_src: srcToken.address,
          token_src_blockchain_id: srcChain,
          token_dst: dstToken.address,
          token_dst_blockchain_id: dstChain,
          amount: debouncedAmount,
          quote_type: 'exact_input' as const,
        }
      : undefined;
  const quoteQuery = useQuote({
    params: { payload: quotePayload },
    // dapp-kit refreshes quotes every 3s; a whole room shares one IP, so slow it down.
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quoteResult = quotePayload ? quoteQuery.data : undefined;
  const quoted = quoteResult?.ok ? quoteResult.value.quoted_amount : undefined;
  const minOutput = quoted !== undefined && quoted > 0n ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const quoteError = quoteResult && !quoteResult.ok ? quoteErrorMessage(quoteResult.error) : undefined;
  const quoteIsCurrent = amount !== undefined && amount === debouncedAmount && !quoteQuery.isLoading;

  const insufficient = amount !== undefined && balance !== undefined && amount > balance;

  function flip() {
    setSrcSymbol(dstToken?.symbol);
    setDstSymbol(srcToken?.symbol);
    setAmountText('');
  }

  function setMax() {
    if (!srcToken || balance === undefined) return;
    const reserve = isNativeToken(srcToken) ? NATIVE_GAS_RESERVE[srcChain] : 0n;
    const max = balance > reserve ? balance - reserve : 0n;
    setAmountText(formatTokenAmount(max, srcToken.decimals, srcToken.decimals).replace(/,/g, ''));
  }

  function submit() {
    if (!srcToken || !dstToken || !wallet.address || !wallet.walletProvider || !amount || !minOutput) return;
    const address = wallet.address;
    const minOutputAmount = minOutput;
    void flow.run({
      srcChainKey: srcChain,
      walletProvider: wallet.walletProvider,
      checkApproval: true,
      build: async () => {
        // The deadline is enforced against the hub (Sonic) block time, never the client clock.
        const deadline = await sodax.swaps.getSwapDeadline(SWAP_DEADLINE_SECONDS);
        if (!deadline.ok) return deadline;
        return {
          ok: true,
          value: {
            params: {
              inputToken: srcToken.address,
              outputToken: dstToken.address,
              inputAmount: amount,
              minOutputAmount,
              deadline: deadline.value,
              allowPartialFill: false,
              srcChainKey: srcChain,
              dstChainKey: dstChain,
              srcAddress: address,
              dstAddress: address,
              data: '0x',
            },
          },
        };
      },
    });
  }

  if (flow.state.phase !== 'idle') {
    return (
      <FlowProgress
        state={flow.state}
        kind="swap"
        fillLabel={`Solver sends ${dstToken?.symbol ?? 'tokens'} on ${chainName(dstChain)}`}
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
      return { label: `Switch to ${chainName(srcChain)}`, onClick: wallet.switchChain, disabled: false };
    if (sameToken) return { label: 'Pick two different tokens', disabled: true };
    if (!amount) return { label: 'Enter an amount', disabled: true };
    if (insufficient) return { label: `Insufficient ${srcToken?.symbol}`, disabled: true };
    if (!quoteIsCurrent) return { label: 'Getting quote…', disabled: true };
    if (!minOutput) return { label: 'No quote', disabled: true };
    if (!acknowledged) return { label: 'Confirm to swap', disabled: true };
    return { label: `Swap to ${dstToken?.symbol}`, onClick: submit, disabled: false };
  })();

  return (
    <div className="flex flex-col gap-4">
      <Field label="Pay with">
        <TokenSelect
          value={srcToken?.address ?? ''}
          tokens={srcTokens}
          balances={balances}
          onChange={address => setSrcSymbol(srcTokens.find(t => t.address === address)?.symbol)}
        />
      </Field>

      <Field
        label="You pay"
        hint={
          srcToken && balance !== undefined ? (
            <button type="button" onClick={setMax} className="hover:text-primary">
              Balance {formatTokenAmount(balance, srcToken.decimals)} {srcToken.symbol} · <strong>Max</strong>
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

      <div className="flex justify-center">
        <Button variant="outline" size="icon" onClick={flip} aria-label="Swap direction">
          <ArrowDownUpIcon />
        </Button>
      </div>

      <Field label="Receive">
        <TokenSelect
          value={dstToken?.address ?? ''}
          tokens={dstTokens}
          onChange={address => setDstSymbol(dstTokens.find(t => t.address === address)?.symbol)}
        />
      </Field>

      <SlippagePicker value={slippageBps} onChange={setSlippageBps} />

      <div className="flex flex-col gap-2 bg-muted/60 p-4">
        <SummaryRow label="You receive (est.)" strong>
          {dstToken && quoted !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(quoted, dstToken.decimals)} ${dstToken.symbol}`
            : quoteQuery.isFetching && quotePayload
              ? 'Quoting…'
              : '–'}
        </SummaryRow>
        <SummaryRow label="Minimum accepted">
          {dstToken && minOutput !== undefined && quoteIsCurrent
            ? `${formatTokenAmount(minOutput, dstToken.decimals)} ${dstToken.symbol}`
            : '–'}
        </SummaryRow>
        <SummaryRow label="Sent to">Your wallet on {chainName(dstChain)}</SummaryRow>
        {quoteError && amount !== undefined && <p className="text-xs text-destructive">{quoteError}</p>}
      </div>

      <Callout className="flex flex-col gap-2 text-xs">
        <p>
          <strong>Real funds.</strong> You sign one intent; a solver fills it for at least the minimum above, or it
          expires and is refundable. Cross-network swaps usually settle in under 2 minutes.
        </p>
        <label className="flex cursor-pointer items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="size-4 accent-primary"
          />
          I’ve checked the amounts
        </label>
      </Callout>

      <Button size="lg" onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    </div>
  );
}
