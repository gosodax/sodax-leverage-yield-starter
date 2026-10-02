import type { LeverageYieldVault, XToken } from '@sodax/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { DEFAULT_SLIPPAGE_BPS, getDepositTokens, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useWithdrawFlow } from '../hooks/useVaultFlow';
import { useWithdrawQuote } from '../hooks/useVaultQuote';
import { SHARE_DECIMALS } from '../lib/vaults';
import { AmountField } from './AmountField';
import { FlowSteps } from './FlowSteps';
import { ChainLogo, ChainPicker, Label, TokenPicker } from './Pickers';
import { QuoteRows } from './QuoteRows';

type Holding = { chainKey: SourceChainKey; shares: bigint };

export function WithdrawForm({
  vault,
  holdings,
  onDone,
}: {
  vault: LeverageYieldVault;
  holdings: Holding[];
  onDone: () => void;
}) {
  const [heldOn, setHeldOn] = useState<SourceChainKey | undefined>(holdings[0]?.chainKey);
  const holding = holdings.find(h => h.chainKey === heldOn) ?? holdings[0];
  const srcChainKey = holding?.chainKey;
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey | undefined>(srcChainKey);
  const dst = dstChainKey ?? srcChainKey;
  const tokens = dst ? getDepositTokens(dst) : [];
  const [token, setToken] = useState<XToken | undefined>();
  const outToken =
    (token && tokens.find(t => t.address === token.address)) ?? tokens.find(t => t.symbol === 'USDC') ?? tokens[0];
  const [input, setInput] = useState('');

  const wallet = useEvmWallet(srcChainKey ?? 'sonic');
  const flow = useWithdrawFlow();
  const busy = flow.state.status === 'running';

  const shares = parseTokenAmount(input, SHARE_DECIMALS);
  const debounced = useDebouncedValue(shares);
  const quote = useWithdrawQuote({
    vault,
    chainKey: dst ?? 'sonic',
    token: dst ? outToken : undefined,
    amount: debounced,
  });
  const stale = shares !== debounced || quote.isFetching;
  const over = shares !== undefined && holding !== undefined && shares > holding.shares;

  useEffect(() => {
    if (flow.state.status === 'done') onDone();
  }, [flow.state.status, onDone]);

  if (!holding || !srcChainKey || !dst) {
    return <p className="py-6 text-sm text-muted-foreground">No shares in this vault yet. Deposit first.</p>;
  }

  const withdraw = () => {
    if (!outToken || !shares || !quote.minOut || !wallet.address || !wallet.walletProvider) return;
    void flow.run({
      vault,
      srcChainKey,
      srcAddress: wallet.address,
      dstChainKey: dst,
      token: outToken,
      shares,
      minOut: quote.minOut,
      walletProvider: wallet.walletProvider,
    });
  };

  const ready = shares !== undefined && shares > 0n && quote.minOut !== undefined && !stale && !over;

  return (
    <div className="flex flex-col gap-4">
      {holdings.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label>Shares held from</Label>
          <div className="flex flex-wrap gap-2">
            {holdings.map(h => (
              <button
                key={h.chainKey}
                type="button"
                disabled={busy}
                onClick={() => {
                  setHeldOn(h.chainKey);
                  setInput('');
                  flow.reset();
                }}
                className={cn(
                  'flex items-center gap-2 border px-3 py-1.5 text-sm',
                  h.chainKey === srcChainKey
                    ? 'border-foreground bg-foreground text-background'
                    : 'hover:border-foreground',
                )}
              >
                <ChainLogo chainKey={h.chainKey} />
                {chainName(h.chainKey)} · {formatTokenAmount(h.shares, SHARE_DECIMALS)}
              </button>
            ))}
          </div>
        </div>
      )}
      <AmountField
        label="Withdraw shares"
        value={input}
        onChange={v => {
          setInput(v);
          if (!busy) flow.reset();
        }}
        symbol={vault.name}
        balance={holding.shares}
        decimals={SHARE_DECIMALS}
        onMax={() => setInput(formatTokenAmount(holding.shares, SHARE_DECIMALS, SHARE_DECIMALS).replace(/,/g, ''))}
        disabled={busy}
        invalid={over || (input !== '' && shares === undefined)}
      />
      <div className="grid grid-cols-2 gap-3">
        <ChainPicker
          label="To network"
          value={dst}
          onChange={next => {
            setDstChainKey(next);
            setToken(undefined);
            flow.reset();
          }}
          disabled={busy}
        />
        <TokenPicker
          label="Receive"
          tokens={tokens}
          value={outToken}
          onChange={t => {
            setToken(t);
            flow.reset();
          }}
          disabled={busy}
        />
      </div>

      {shares !== undefined && shares > 0n && outToken && (
        <QuoteRows
          rows={[
            {
              label: 'You receive',
              value:
                quote.quoted !== undefined
                  ? `${formatTokenAmount(quote.quoted, outToken.decimals)} ${outToken.symbol}`
                  : '…',
              strong: true,
            },
            {
              label: `Minimum (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`,
              value:
                quote.minOut !== undefined
                  ? `${formatTokenAmount(quote.minOut, outToken.decimals)} ${outToken.symbol}`
                  : '…',
            },
            { label: 'Delivered to', value: `Your wallet on ${chainName(dst)}` },
          ]}
        />
      )}
      {quote.error && <Callout variant="destructive">{quote.error}</Callout>}
      {over && <Callout variant="destructive">More than the shares you hold from {chainName(srcChainKey)}.</Callout>}

      {flow.state.status !== 'idle' && <FlowSteps flow={flow.state} srcChainKey={srcChainKey} withApprove={false} />}
      {flow.state.error && <Callout variant="destructive">{flow.state.error}</Callout>}
      {flow.state.status === 'done' && (
        <Callout variant="success">Withdrawn to your wallet on {chainName(dst)}.</Callout>
      )}

      <p className="text-xs text-muted-foreground">
        One signature on {chainName(srcChainKey)}, no approval. The vault unwinds part of its leverage to pay you; the
        amount you receive can differ from the share value shown.
      </p>

      {!wallet.isConnected ? (
        <Button size="lg" onClick={wallet.connect}>
          Connect wallet
        </Button>
      ) : wallet.isWrongChain ? (
        <Button size="lg" onClick={wallet.switchChain}>
          Switch to {chainName(srcChainKey)}
        </Button>
      ) : (
        <Button size="lg" onClick={withdraw} disabled={!ready || busy}>
          {busy ? 'Confirm in wallet…' : stale && shares ? 'Updating quote…' : 'Withdraw'}
        </Button>
      )}
    </div>
  );
}
