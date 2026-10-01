import { useLeverageYieldDeposit, useLeverageYieldQuote } from '@sodax/dapp-kit';
import type { LeverageYieldQuoteParams } from '@sodax/sdk';
import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { ArrowDownIcon, CheckCircle2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { ChainSelect, quoteErrorText, TokenSelect, useTokenBalance } from './pickers';
import { RiskNotice } from './RiskNotice';
import { SlippageControl, useSlippage } from './SlippageControl';
import { TxSteps } from './TxSteps';
import { useVaultSwapFlow } from './useVaultSwapFlow';
import { underlyingSymbol } from './vaults';

const NATIVE = '0x0000000000000000000000000000000000000000';

export function DepositPanel({
  vaults,
  vaultName,
  onVaultChange,
}: {
  vaults: readonly LeverageYieldVault[];
  vaultName: string;
  onVaultChange: (name: string) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [tokenAddress, setTokenAddress] = useState<string | undefined>(
    () => getTokenByKey(DEFAULT_SOURCE_CHAIN, DEFAULT_TOKEN_KEY)?.address,
  );
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useSlippage();
  const [acknowledged, setAcknowledged] = useState(false);

  const wallet = useEvmWallet(chainKey);
  const { balance, isLoading: balanceLoading } = useTokenBalance(chainKey, token, wallet.address);
  const flow = useVaultSwapFlow('deposit');
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();

  // Keep a valid token when the network changes (prefer the same symbol, e.g. USDC → USDC).
  useEffect(() => {
    if (tokens.some(t => t.address === tokenAddress)) return;
    const sameSymbol = tokens.find(t => t.symbol === token?.symbol);
    setTokenAddress((sameSymbol ?? getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ?? tokens[0])?.address);
  }, [chainKey, tokens, tokenAddress, token?.symbol]);

  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;
  const isNative = token?.address.toLowerCase() === NATIVE;
  const spendable =
    balance === undefined
      ? undefined
      : isNative
        ? balance > NATIVE_GAS_RESERVE[chainKey]
          ? balance - NATIVE_GAS_RESERVE[chainKey]
          : 0n
        : balance;
  const insufficient = inputAmount !== undefined && spendable !== undefined && inputAmount > spendable;

  // Gross amount: the leverage-yield quote deducts the same fee the vault intent charges.
  const quotePayload = useMemo<LeverageYieldQuoteParams | undefined>(() => {
    if (!vault || !token || !inputAmount || inputAmount <= 0n) return undefined;
    return {
      token_src: token.address,
      token_src_blockchain_id: chainKey,
      token_dst: vault.vault,
      token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
      amount: inputAmount,
      quote_type: 'exact_input',
    };
  }, [vault, token, inputAmount, chainKey]);

  const quoteQuery = useLeverageYieldQuote({ params: { payload: quotePayload } });
  const quoteResult = quotePayload ? quoteQuery.data : undefined;
  const quoted = quoteResult?.ok ? quoteResult.value.quoted_amount : undefined;
  const minOut = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const quoteLoading = quotePayload !== undefined && quoteQuery.isLoading;

  // A finished or failed run shouldn't linger once the user edits the form.
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputs are reset triggers
  useEffect(() => {
    if (flow.state.stage === 'done' || flow.state.stage === 'failed') flow.reset();
  }, [vaultName, chainKey, tokenAddress, amount]);

  if (!vault || !token) return null;
  const asset = underlyingSymbol(vault.name);

  const submit = () => {
    if (!wallet.walletProvider || !wallet.address || !inputAmount || minOut === undefined || minOut <= 0n) return;
    const { walletProvider, address } = wallet;
    void flow.run({
      srcChainKey: chainKey,
      walletProvider,
      checkApproval: !isNative,
      build: () =>
        buildDeposit({
          vault: vault.vault,
          srcChainKey: chainKey,
          srcAddress: address,
          inputToken: token.address,
          inputAmount,
          minOutputAmount: minOut,
        }),
    });
  };

  const locked = flow.busy;
  const canSubmit =
    wallet.isConnected &&
    !wallet.isWrongChain &&
    !locked &&
    !insufficient &&
    minOut !== undefined &&
    minOut > 0n &&
    acknowledged;

  let cta = `Deposit ${token.symbol}`;
  if (!wallet.isConnected) cta = 'Connect wallet';
  else if (wallet.isWrongChain) cta = `Switch to ${chainName(chainKey)}`;
  else if (!inputAmount) cta = 'Enter an amount';
  else if (insufficient) cta = `Not enough ${token.symbol}`;
  else if (quoteLoading) cta = 'Fetching quote…';
  else if (minOut === undefined) cta = 'No quote';
  else if (!acknowledged) cta = 'Acknowledge the risks';
  else if (locked) cta = 'Depositing…';

  const onCta = () => {
    if (!wallet.isConnected) return wallet.connect();
    if (wallet.isWrongChain) return wallet.switchChain();
    submit();
  };

  return (
    <Card id="deposit" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Deposit</CardTitle>
        <CardDescription>Pay with a token on any supported network and receive vault shares on Sonic.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deposit-vault" className="text-xs font-medium text-muted-foreground">
            Vault
          </label>
          <Select value={vault.name} onValueChange={onVaultChange} disabled={locked}>
            <SelectTrigger id="deposit-vault">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vaults.map(v => (
                <SelectItem key={v.name} value={v.name}>
                  {underlyingSymbol(v.name)} <span className="font-mono text-xs text-muted-foreground">{v.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-secondary/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <ChainSelect id="deposit-chain" value={chainKey} onChange={setChainKey} disabled={locked} />
            <TokenSelect
              id="deposit-token"
              tokens={tokens}
              value={token.address}
              onChange={setTokenAddress}
              disabled={locked}
            />
          </div>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={locked}
            className="h-14 text-2xl font-semibold tabular-nums"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Balance:{' '}
              {balanceLoading
                ? '…'
                : wallet.address
                  ? `${formatTokenAmount(balance, token.decimals)} ${token.symbol}`
                  : '–'}
            </span>
            {spendable !== undefined && spendable > 0n && (
              <button
                type="button"
                className="font-semibold text-primary hover:underline disabled:opacity-50"
                disabled={locked}
                onClick={() =>
                  setAmount(formatTokenAmount(spendable, token.decimals, token.decimals).replace(/,/g, ''))
                }
              >
                Max
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <ArrowDownIcon className="size-4 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">You receive (est.)</span>
            {quoteLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="font-semibold tabular-nums">
                {quoted !== undefined ? `${formatTokenAmount(quoted, 18)} ${vault.name}` : '–'}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Minimum accepted</span>
            <span className="tabular-nums">
              {minOut !== undefined ? `${formatTokenAmount(minOut, 18)} ${vault.name}` : '–'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Slippage</span>
            <SlippageControl value={slippageBps} onChange={setSlippageBps} disabled={locked} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shares held on</span>
            <span>Sonic (your hub wallet for {chainName(chainKey)})</span>
          </div>
          {quoteResult && !quoteResult.ok && (
            <p className="text-xs text-destructive">{quoteErrorText(quoteResult.error)}</p>
          )}
        </div>

        <RiskNotice asset={asset} acknowledged={acknowledged} onAcknowledge={setAcknowledged} disabled={locked} />

        <Button size="lg" onClick={onCta} disabled={wallet.isConnected && !wallet.isWrongChain && !canSubmit}>
          {cta}
        </Button>

        {flow.state.stage !== 'idle' && <TxSteps steps={flow.steps} />}
        {flow.state.stage === 'failed' && <Callout variant="destructive">{flow.state.error}</Callout>}
        {flow.state.stage === 'done' && (
          <Callout variant="success" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0" />
            Deposit filled. Your {vault.name} shares are in “Your positions”.
          </Callout>
        )}
      </CardContent>
    </Card>
  );
}
