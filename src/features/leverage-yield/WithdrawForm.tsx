import {
  useLeverageYieldQuote,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
} from '@sodax/dapp-kit';
import { messageOf } from '@sodax/sdk';
import { ChainKeys } from '@sodax/types';
import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { formatBps, formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { TransactionDialog, type TxPhase, useTxSteps } from './TransactionDialog';
import { useShareHoldings } from './usePosition';

const SHARE_DECIMALS = 18;
const STEP_LABELS = { withdraw: 'Sign the withdrawal, deliver to Sonic, solver fills' };

type Props = { vaultName: string };

export function WithdrawForm({ vaultName }: Props) {
  const { sodax } = useSodaxContext();
  const vault = sodax.leverageYield.getVault(vaultName);
  const { holdings } = useShareHoldings(vault?.vault);
  const funded = holdings.filter(holding => holding.shares > 0n);

  const [fromChain, setFromChain] = useState<SourceChainKey | undefined>();
  const [dstChain, setDstChain] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [tokenAddress, setTokenAddress] = useState<string | undefined>();
  const [amount, setAmount] = useState('');

  const source = funded.find(holding => holding.chainKey === fromChain) ?? funded[0];
  const srcChainKey = source?.chainKey ?? DEFAULT_SOURCE_CHAIN;
  const { address, walletProvider, isConnected, isWrongChain, switchChain, connect } = useEvmWallet(srcChainKey);

  const tokens = useMemo(() => getDepositTokens(dstChain), [dstChain]);
  const token =
    tokens.find(t => t.address === tokenAddress) ?? tokens.find(t => t.symbol === DEFAULT_TOKEN_KEY) ?? tokens[0];
  const shares = parseTokenAmount(amount, SHARE_DECIMALS);
  const insufficient = shares !== undefined && source !== undefined && shares > source.shares;

  const { data: quote, isFetching } = useLeverageYieldQuote({
    params: {
      payload:
        vault && token && shares && shares > 0n && !insufficient
          ? {
              token_src: vault.vault,
              token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
              token_dst: token.address,
              token_dst_blockchain_id: dstChain,
              amount: shares,
              quote_type: 'exact_input',
            }
          : undefined,
    },
  });
  const quotedOut = quote?.ok ? quote.value.quoted_amount : undefined;
  const minOut = quotedOut === undefined ? undefined : minAmountAfterSlippage(quotedOut, DEFAULT_SLIPPAGE_BPS);

  const { steps, update, reset } = useTxSteps(STEP_LABELS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<TxPhase>('review');
  const [error, setError] = useState<string>();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();

  const fail = (message: string) => {
    update('withdraw', 'error');
    setError(message);
    setPhase('failed');
  };

  async function withdraw() {
    if (!vault || !token || !shares || !minOut || !address || !walletProvider) return;
    reset();
    setError(undefined);
    setPhase('running');
    update('withdraw', 'active');

    const built = await buildWithdraw({
      vault: vault.vault,
      srcChainKey,
      srcAddress: address,
      dstChainKey: dstChain,
      outputToken: token.address,
      inputAmount: shares,
      minOutputAmount: minOut,
    });
    if (!built.ok) return fail(messageOf(built.error, 'Could not build the withdrawal'));

    const swap = await vaultSwap({ ...built.value, walletProvider });
    if (!swap.ok) return fail(messageOf(swap.error, 'Withdrawal failed'));

    const { srcTxHash, dstTxHash } = swap.value.intentDeliveryInfo;
    const links = [
      { label: `Withdrawal on ${chainName(srcChainKey)}`, url: explorerTxUrl(srcChainKey, srcTxHash) },
      { label: `Delivered on ${chainName(dstChain)}`, url: explorerTxUrl(dstChain, dstTxHash) },
    ].flatMap(({ label, url }) => (url ? [{ label, url }] : []));
    update('withdraw', 'done', links);
    setPhase('done');
  }

  function openReview() {
    reset();
    setError(undefined);
    setPhase('review');
    setDialogOpen(true);
  }

  const canReview = !!vault && !!token && !!shares && !!minOut && !insufficient && !isWrongChain;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw</CardTitle>
        <CardDescription>Swap your {vaultName} shares back into any supported token.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!source ? (
          <p className="text-sm text-muted-foreground">
            {isConnected ? `You hold no ${vaultName} shares yet.` : 'Connect a wallet to see your shares.'}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Shares held via</span>
              <Select value={srcChainKey} onValueChange={value => setFromChain(value as SourceChainKey)}>
                <SelectTrigger aria-label="Shares held via">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {funded.map(holding => (
                    <SelectItem key={holding.chainKey} value={holding.chainKey}>
                      {chainName(holding.chainKey)} ({formatTokenAmount(holding.shares, SHARE_DECIMALS, 6)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Shares to withdraw</span>
              <div className="flex gap-2">
                <Input
                  aria-label="Shares to withdraw"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.0"
                />
                <Button variant="outline" onClick={() => setAmount(formatUnits(source.shares, SHARE_DECIMALS))}>
                  Max
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Receive on</span>
                <Select
                  value={dstChain}
                  onValueChange={value => {
                    setDstChain(value as SourceChainKey);
                    setTokenAddress(undefined);
                  }}
                >
                  <SelectTrigger aria-label="Receive on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_CHAINS.map(key => (
                      <SelectItem key={key} value={key}>
                        {chainName(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Token</span>
                <Select value={token?.address} onValueChange={setTokenAddress}>
                  <SelectTrigger aria-label="Token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map(t => (
                      <SelectItem key={t.address} value={t.address}>
                        {t.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-4 text-sm">
              <dt className="text-muted-foreground">You receive (est.)</dt>
              <dd className="text-right font-medium">
                {quotedOut === undefined
                  ? isFetching
                    ? 'Fetching quote…'
                    : '–'
                  : `${formatTokenAmount(quotedOut, token?.decimals ?? 18)} ${token?.symbol}`}
              </dd>
              <dt className="text-muted-foreground">Minimum you accept</dt>
              <dd className="text-right font-medium">
                {minOut === undefined ? '–' : `${formatTokenAmount(minOut, token?.decimals ?? 18)} ${token?.symbol}`}
              </dd>
            </dl>

            {quote && !quote.ok ? (
              <Callout variant="destructive">
                No route right now. Solvers may be rebalancing; the quote retries automatically.
              </Callout>
            ) : null}
            {insufficient ? (
              <Callout variant="destructive">You only hold that many shares on the selected network.</Callout>
            ) : null}

            {isConnected ? (
              isWrongChain ? (
                <Button onClick={switchChain}>Switch to {chainName(srcChainKey)}</Button>
              ) : (
                <Button disabled={!canReview} onClick={openReview}>
                  Review withdrawal
                </Button>
              )
            ) : (
              <Button onClick={connect}>Connect wallet</Button>
            )}

            <TransactionDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title={`Withdraw from ${vaultName}`}
              rows={[
                { label: 'You burn', value: `${amount} ${vaultName}` },
                {
                  label: 'You receive (est.)',
                  value: `${formatTokenAmount(quotedOut, token?.decimals ?? 18)} ${token?.symbol} on ${chainName(dstChain)}`,
                },
                {
                  label: `Minimum you accept (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`,
                  value: `${formatTokenAmount(minOut, token?.decimals ?? 18)} ${token?.symbol}`,
                },
              ]}
              steps={steps}
              phase={phase}
              error={error}
              confirmLabel="Confirm withdrawal"
              onConfirm={withdraw}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
