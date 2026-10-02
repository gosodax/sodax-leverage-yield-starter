import type { LeverageYieldVault, XToken } from '@sodax/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useDepositFlow } from '../hooks/useVaultFlow';
import { useDepositQuote } from '../hooks/useVaultQuote';
import { SHARE_DECIMALS, underlying } from '../lib/vaults';
import { AmountField } from './AmountField';
import { FlowSteps } from './FlowSteps';
import { ChainPicker, TokenPicker } from './Pickers';
import { QuoteRows } from './QuoteRows';
import { RiskNotice } from './RiskNotice';

const isNative = (token: XToken) => /^0x0{40}$/i.test(token.address) || /^0xe{40}$/i.test(token.address);

export function DepositForm({ vault, onDone }: { vault: LeverageYieldVault; onDone: () => void }) {
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = getDepositTokens(chainKey);
  const [token, setToken] = useState<XToken | undefined>(
    () => getTokenByKey(DEFAULT_SOURCE_CHAIN, DEFAULT_TOKEN_KEY) ?? getDepositTokens(DEFAULT_SOURCE_CHAIN)[0],
  );
  const [input, setInput] = useState('');
  const wallet = useEvmWallet(chainKey);
  const flow = useDepositFlow();
  const busy = flow.state.status === 'running';

  const amount = token ? parseTokenAmount(input, token.decimals) : undefined;
  const debounced = useDebouncedValue(amount);
  const balance = useTokenBalance(chainKey, token, wallet.address);
  const quote = useDepositQuote({ vault, chainKey, token, amount: debounced });
  const stale = amount !== debounced || quote.isFetching;
  const over = amount !== undefined && balance !== undefined && amount > balance;

  // Keep the token when switching networks if the new one has it, else fall back to the first.
  const changeChain = (next: SourceChainKey) => {
    setChainKey(next);
    const same = token ? getDepositTokens(next).find(t => t.symbol === token.symbol) : undefined;
    setToken(same ?? getTokenByKey(next, DEFAULT_TOKEN_KEY) ?? getDepositTokens(next)[0]);
    flow.reset();
  };

  useEffect(() => {
    if (flow.state.status === 'done') onDone();
  }, [flow.state.status, onDone]);

  const max = () => {
    if (!token || balance === undefined) return;
    const usable = isNative(token) ? balance - NATIVE_GAS_RESERVE[chainKey] : balance;
    setInput(usable > 0n ? formatTokenAmount(usable, token.decimals, token.decimals).replace(/,/g, '') : '0');
  };

  const deposit = () => {
    if (!token || !amount || !quote.minOut || !wallet.address || !wallet.walletProvider) return;
    void flow.run({
      vault,
      srcChainKey: chainKey,
      srcAddress: wallet.address,
      token,
      amount,
      minShares: quote.minOut,
      walletProvider: wallet.walletProvider,
    });
  };

  const { symbol } = underlying(vault);
  const ready = amount !== undefined && amount > 0n && quote.minOut !== undefined && !stale && !over;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <ChainPicker label="From network" value={chainKey} onChange={changeChain} disabled={busy} />
        <TokenPicker
          label="Pay with"
          tokens={tokens}
          value={token}
          onChange={t => {
            setToken(t);
            flow.reset();
          }}
          disabled={busy}
        />
      </div>
      <AmountField
        label="Deposit"
        value={input}
        onChange={v => {
          setInput(v);
          if (flow.state.status !== 'running') flow.reset();
        }}
        symbol={token?.symbol ?? ''}
        balance={balance}
        decimals={token?.decimals ?? 18}
        onMax={wallet.isConnected ? max : undefined}
        disabled={busy}
        invalid={over || (input !== '' && amount === undefined)}
      />

      {amount !== undefined && amount > 0n && (
        <QuoteRows
          rows={[
            {
              label: 'You receive',
              value:
                quote.quoted !== undefined ? `${formatTokenAmount(quote.quoted, SHARE_DECIMALS)} ${vault.name}` : '…',
              strong: true,
            },
            {
              label: `Minimum (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`,
              value: quote.minOut !== undefined ? `${formatTokenAmount(quote.minOut, SHARE_DECIMALS)} shares` : '…',
            },
            { label: 'Vault asset', value: symbol },
            { label: 'Shares held', value: `SODAX hub wallet · from ${chainName(chainKey)}` },
          ]}
        />
      )}
      {quote.error && <Callout variant="destructive">{quote.error}</Callout>}
      {over && (
        <Callout variant="destructive">
          Not enough {token?.symbol} on {chainName(chainKey)}.
        </Callout>
      )}

      {flow.state.status !== 'idle' && (
        <FlowSteps flow={flow.state} srcChainKey={chainKey} withApprove={!isNative(token ?? ({} as XToken))} />
      )}
      {flow.state.error && <Callout variant="destructive">{flow.state.error}</Callout>}
      {flow.state.status === 'done' && (
        <Callout variant="success">Deposited. Your shares are in your SODAX hub wallet on Sonic.</Callout>
      )}

      <RiskNotice />

      {!wallet.isConnected ? (
        <Button size="lg" onClick={wallet.connect}>
          Connect wallet
        </Button>
      ) : wallet.isWrongChain ? (
        <Button size="lg" onClick={wallet.switchChain}>
          Switch to {chainName(chainKey)}
        </Button>
      ) : (
        <Button size="lg" onClick={deposit} disabled={!ready || busy}>
          {busy ? 'Confirm in wallet…' : stale && amount ? 'Updating quote…' : `Deposit into ${symbol} vault`}
        </Button>
      )}
    </div>
  );
}
