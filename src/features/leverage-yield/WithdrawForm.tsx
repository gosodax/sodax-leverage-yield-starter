import { useLeverageYieldQuote, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import type { LeverageYieldQuoteParams, LeverageYieldVault } from '@sodax/sdk';
import { ChainKeys, type XToken } from '@sodax/types';
import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  DEPOSIT_TOKEN_KEYS,
  getTokenByKey,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { SlippageSelect } from './SlippageSelect';
import { describeQuoteError, SHARE_DECIMALS } from './shared';
import { useVaultSwapFlow } from './useVaultSwapFlow';
import { VaultSwapDialog } from './VaultSwapDialog';

export function WithdrawForm({
  vaults,
  vaultName,
  onVaultChange,
}: {
  vaults: LeverageYieldVault[];
  vaultName: string;
  onVaultChange: (name: string) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName);

  // The network the user deposited from: its hub wallet holds the shares, and the user signs there.
  const [srcChainKey, setSrcChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  // Where the swapped-back tokens are delivered.
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [tokenKey, setTokenKey] = useState<string>(DEFAULT_TOKEN_KEY);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  const tokenOptions = useMemo(
    () =>
      DEPOSIT_TOKEN_KEYS.map(key => ({ key, token: getTokenByKey(dstChainKey, key) })).filter(
        (option): option is { key: (typeof DEPOSIT_TOKEN_KEYS)[number]; token: XToken } => option.token !== undefined,
      ),
    [dstChainKey],
  );
  const selectedOption = tokenOptions.find(option => option.key === tokenKey) ?? tokenOptions[0];
  const outputToken = selectedOption?.token;

  const wallet = useEvmWallet(srcChainKey);
  const flow = useVaultSwapFlow();

  // Same holder list as YourPosition, so React Query dedupes the reads.
  const holders = useMemo(
    () =>
      wallet.address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address: wallet.address as string })) : undefined,
    [wallet.address],
  );
  const holdings = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const shareBalance = holdings[SOURCE_CHAINS.indexOf(srcChainKey)]?.data?.shares;

  const inputShares = parseTokenAmount(amount, SHARE_DECIMALS);

  const quotePayload: LeverageYieldQuoteParams | undefined =
    vault && outputToken && inputShares !== undefined && inputShares > 0n
      ? {
          token_src: vault.vault,
          token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
          token_dst: outputToken.address,
          token_dst_blockchain_id: dstChainKey,
          amount: inputShares,
          quote_type: 'exact_input',
        }
      : undefined;

  const { data: quote } = useLeverageYieldQuote({
    params: { payload: quotePayload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quotedOut = quotePayload && quote?.ok ? quote.value.quoted_amount : undefined;
  const minOutputAmount = quotedOut !== undefined ? minAmountAfterSlippage(quotedOut, slippageBps) : undefined;
  const quoteError = quotePayload && quote && !quote.ok ? describeQuoteError(quote.error) : undefined;

  const insufficient = inputShares !== undefined && shareBalance !== undefined && inputShares > shareBalance;

  const setMax = () => {
    if (shareBalance !== undefined && shareBalance > 0n) setAmount(formatUnits(shareBalance, SHARE_DECIMALS));
  };

  const busy = flow.state.phase === 'running' || flow.state.phase === 'filling';
  const canSubmit =
    vault !== undefined &&
    outputToken !== undefined &&
    wallet.isConnected &&
    !wallet.isWrongChain &&
    wallet.walletProvider !== undefined &&
    wallet.address !== undefined &&
    inputShares !== undefined &&
    inputShares > 0n &&
    minOutputAmount !== undefined &&
    !insufficient &&
    !busy;

  const handleWithdraw = () => {
    if (!canSubmit || !vault || !outputToken || !wallet.address || !wallet.walletProvider) return;
    if (inputShares === undefined || minOutputAmount === undefined) return;
    void flow.start(
      {
        action: 'withdraw',
        vault: vault.vault,
        srcChainKey,
        srcAddress: wallet.address,
        dstChainKey,
        outputToken: outputToken.address,
        inputAmount: inputShares,
        minOutputAmount,
      },
      wallet.walletProvider,
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Swap {vaultName} shares from your hub wallet back into a token on a network you choose.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="withdraw-vault" className="text-sm font-medium">
            Vault
          </label>
          <Select value={vaultName} onValueChange={onVaultChange}>
            <SelectTrigger id="withdraw-vault">
              <SelectValue placeholder="Select a vault" />
            </SelectTrigger>
            <SelectContent>
              {vaults.map(v => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="withdraw-src" className="text-sm font-medium">
            Shares held via
          </label>
          <Select value={srcChainKey} onValueChange={value => setSrcChainKey(value as SourceChainKey)}>
            <SelectTrigger id="withdraw-src">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_CHAINS.map(key => (
                <SelectItem key={key} value={key}>
                  {chainLogo(key) && <img src={chainLogo(key)} alt="" className="size-4 rounded-full" />}
                  {chainName(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The network you deposited from — you sign the withdrawal there.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="withdraw-amount" className="text-sm font-medium">
              Amount (shares)
            </label>
            {wallet.isConnected && (
              <button
                type="button"
                onClick={setMax}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Shares: {formatTokenAmount(shareBalance, SHARE_DECIMALS)} — Max
              </button>
            )}
          </div>
          <Input
            id="withdraw-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
          {insufficient && <p className="text-xs text-destructive">You don't hold that many shares on this network.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="withdraw-dst" className="text-sm font-medium">
              Receive on
            </label>
            <Select value={dstChainKey} onValueChange={value => setDstChainKey(value as SourceChainKey)}>
              <SelectTrigger id="withdraw-dst">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_CHAINS.map(key => (
                  <SelectItem key={key} value={key}>
                    {chainLogo(key) && <img src={chainLogo(key)} alt="" className="size-4 rounded-full" />}
                    {chainName(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="withdraw-token" className="text-sm font-medium">
              Token
            </label>
            <Select value={selectedOption?.key} onValueChange={setTokenKey}>
              <SelectTrigger id="withdraw-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokenOptions.map(option => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SlippageSelect valueBps={slippageBps} onChange={setSlippageBps} />

        <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
          {quotePayload === undefined ? (
            <p className="text-muted-foreground">Enter a share amount to see a live quote.</p>
          ) : quoteError ? (
            <p className="text-destructive">
              {quoteError} <span className="text-muted-foreground">The quote retries automatically.</span>
            </p>
          ) : quotedOut === undefined ? (
            <p className="text-muted-foreground">Fetching quote…</p>
          ) : (
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">You receive</dt>
                <dd className="font-mono">
                  ≈ {formatTokenAmount(quotedOut, outputToken?.decimals ?? 18)} {outputToken?.symbol} on{' '}
                  {chainName(dstChainKey)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Minimum you accept</dt>
                <dd className="font-mono">
                  {formatTokenAmount(minOutputAmount, outputToken?.decimals ?? 18)} {outputToken?.symbol}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <Callout>
          Withdrawing sells your shares at the current share price. No approval is needed — your hub wallet authorises
          the share spend when you sign.
        </Callout>

        {!wallet.isConnected ? (
          <Button onClick={wallet.connect}>Connect wallet</Button>
        ) : wallet.isWrongChain ? (
          <Button onClick={wallet.switchChain}>Switch to {chainName(srcChainKey)}</Button>
        ) : (
          <Button onClick={handleWithdraw} disabled={!canSubmit}>
            {busy ? 'Withdrawing…' : 'Withdraw'}
          </Button>
        )}
      </CardContent>

      <VaultSwapDialog
        flow={flow}
        approveLabel="Approve"
        summary={`Withdraw ${amount || '…'} ${vaultName} shares to ${outputToken?.symbol ?? ''} on ${chainName(dstChainKey)}`}
      />
    </Card>
  );
}
