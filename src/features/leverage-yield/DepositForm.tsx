import { useBalances, useLeverageYieldQuote } from '@sodax/dapp-kit';
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
  NATIVE_GAS_RESERVE,
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
import { vaultUnderlyingSymbol } from './vaults';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export function DepositForm({
  vaults,
  vaultName,
  onVaultChange,
}: {
  vaults: LeverageYieldVault[];
  vaultName: string;
  onVaultChange: (name: string) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName);

  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [tokenKey, setTokenKey] = useState<string>(DEFAULT_TOKEN_KEY);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  // Derive the token during render so a chain switch can never pair the new chain with the
  // previous chain's token for one frame.
  const tokenOptions = useMemo(
    () =>
      DEPOSIT_TOKEN_KEYS.map(key => ({ key, token: getTokenByKey(chainKey, key) })).filter(
        (option): option is { key: (typeof DEPOSIT_TOKEN_KEYS)[number]; token: XToken } => option.token !== undefined,
      ),
    [chainKey],
  );
  const selectedOption = tokenOptions.find(option => option.key === tokenKey) ?? tokenOptions[0];
  const token = selectedOption?.token;

  const wallet = useEvmWallet(chainKey);
  const flow = useVaultSwapFlow();

  const { data: balances } = useBalances({
    params: { chainKey, tokens: token ? [token] : [], address: wallet.address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = token ? balances?.[token.address] : undefined;

  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;

  const quotePayload: LeverageYieldQuoteParams | undefined =
    vault && token && inputAmount !== undefined && inputAmount > 0n
      ? {
          token_src: token.address,
          token_src_blockchain_id: chainKey,
          token_dst: vault.vault,
          token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
          amount: inputAmount,
          quote_type: 'exact_input',
        }
      : undefined;

  const { data: quote, isFetching: isQuoting } = useLeverageYieldQuote({
    params: { payload: quotePayload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quotedShares = quotePayload && quote?.ok ? quote.value.quoted_amount : undefined;
  const minOutputAmount = quotedShares !== undefined ? minAmountAfterSlippage(quotedShares, slippageBps) : undefined;
  const quoteError = quotePayload && quote && !quote.ok ? describeQuoteError(quote.error) : undefined;

  const isNative = token?.address === NATIVE_ADDRESS;
  const insufficient = inputAmount !== undefined && balance !== undefined && inputAmount > balance;
  const lowGasHint =
    isNative &&
    !insufficient &&
    inputAmount !== undefined &&
    balance !== undefined &&
    balance - inputAmount < NATIVE_GAS_RESERVE[chainKey];

  const setMax = () => {
    if (balance === undefined || !token) return;
    const max = isNative ? balance - NATIVE_GAS_RESERVE[chainKey] : balance;
    setAmount(max > 0n ? formatUnits(max, token.decimals) : '0');
  };

  const busy = flow.state.phase === 'running' || flow.state.phase === 'filling';
  const canSubmit =
    vault !== undefined &&
    token !== undefined &&
    wallet.isConnected &&
    !wallet.isWrongChain &&
    wallet.walletProvider !== undefined &&
    wallet.address !== undefined &&
    inputAmount !== undefined &&
    inputAmount > 0n &&
    minOutputAmount !== undefined &&
    !insufficient &&
    !busy;

  const handleDeposit = () => {
    if (!canSubmit || !vault || !token || !wallet.address || !wallet.walletProvider) return;
    if (inputAmount === undefined || minOutputAmount === undefined) return;
    void flow.start(
      {
        action: 'deposit',
        vault: vault.vault,
        srcChainKey: chainKey,
        srcAddress: wallet.address,
        inputToken: token.address,
        inputAmount,
        minOutputAmount,
      },
      wallet.walletProvider,
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Deposit from any supported network and token. A solver swaps it into {vaultName} vault shares on Sonic.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deposit-vault" className="text-sm font-medium">
            Vault
          </label>
          <Select value={vaultName} onValueChange={onVaultChange}>
            <SelectTrigger id="deposit-vault">
              <SelectValue placeholder="Select a vault" />
            </SelectTrigger>
            <SelectContent>
              {vaults.map(v => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name} · {vaultUnderlyingSymbol(v.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="deposit-chain" className="text-sm font-medium">
              From network
            </label>
            <Select value={chainKey} onValueChange={value => setChainKey(value as SourceChainKey)}>
              <SelectTrigger id="deposit-chain">
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
            <label htmlFor="deposit-token" className="text-sm font-medium">
              Token
            </label>
            <Select value={selectedOption?.key} onValueChange={setTokenKey}>
              <SelectTrigger id="deposit-token">
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="deposit-amount" className="text-sm font-medium">
              Amount
            </label>
            {wallet.isConnected && token && (
              <button
                type="button"
                onClick={setMax}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Balance: {formatTokenAmount(balance, token.decimals)} {token.symbol} — Max
              </button>
            )}
          </div>
          <Input
            id="deposit-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
          {insufficient && <p className="text-xs text-destructive">Insufficient {token?.symbol} balance.</p>}
          {lowGasHint && (
            <p className="text-xs text-muted-foreground">
              Leave some {token?.symbol} in your wallet for gas — use Max to reserve it automatically.
            </p>
          )}
        </div>

        <SlippageSelect valueBps={slippageBps} onChange={setSlippageBps} />

        <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
          {quotePayload === undefined ? (
            <p className="text-muted-foreground">Enter an amount to see a live quote.</p>
          ) : quoteError ? (
            <p className="text-destructive">
              {quoteError} <span className="text-muted-foreground">The quote retries automatically.</span>
            </p>
          ) : quotedShares === undefined ? (
            <p className="text-muted-foreground">Fetching quote…</p>
          ) : (
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">You receive</dt>
                <dd className="font-mono">
                  ≈ {formatTokenAmount(quotedShares, SHARE_DECIMALS)} {vaultName}
                  {isQuoting && <span className="text-muted-foreground"> ·</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Minimum you accept</dt>
                <dd className="font-mono">
                  {formatTokenAmount(minOutputAmount, SHARE_DECIMALS)} {vaultName}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Rate</dt>
                <dd className="font-mono">
                  1 {token?.symbol} ≈{' '}
                  {inputAmount && inputAmount > 0n && token
                    ? formatTokenAmount((quotedShares * 10n ** BigInt(token.decimals)) / inputAmount, SHARE_DECIMALS)
                    : '–'}{' '}
                  shares
                </dd>
              </div>
            </dl>
          )}
        </div>

        <Callout>
          Real funds on mainnet. The vault is leveraged: the APR is variable and can turn negative, and the share price
          can fall. If the fill would deliver less than your minimum, the order simply doesn't fill.
        </Callout>

        {!wallet.isConnected ? (
          <Button onClick={wallet.connect}>Connect wallet</Button>
        ) : wallet.isWrongChain ? (
          <Button onClick={wallet.switchChain}>Switch to {chainName(chainKey)}</Button>
        ) : (
          <Button onClick={handleDeposit} disabled={!canSubmit}>
            {busy ? 'Depositing…' : 'Deposit'}
          </Button>
        )}
      </CardContent>

      <VaultSwapDialog
        flow={flow}
        approveLabel={`Approve ${token?.symbol ?? 'token'}`}
        summary={`Deposit ${amount || '…'} ${token?.symbol ?? ''} from ${chainName(chainKey)} into ${vaultName}`}
      />
    </Card>
  );
}
