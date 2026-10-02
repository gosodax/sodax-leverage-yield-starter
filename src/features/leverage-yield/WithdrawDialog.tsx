import { isUserRejectedError, useLeverageYieldVaultSwap, useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/sdk';
import { ArrowDownIcon, CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { type Delivery, describeError, type Step, setStep, useFillStatus, useVaultQuote } from './flow';
import { ChainSelect, FieldLabel, formatUsd, SlippagePicker, StepList, SummaryRow, TokenSelect } from './parts';
import {
  SHARE_DECIMALS,
  sharesOn,
  shareValue,
  toUsd,
  useShareHoldings,
  useUsdPrice,
  useVaultStats,
  type VaultMeta,
} from './vaults';

type Phase = 'form' | 'signing' | 'tracking';

function planSteps(fromChain: SourceChainKey, dstChain: SourceChainKey, tokenSymbol: string): Step[] {
  return [
    { id: 'sign', label: `Sign the withdraw on ${chainName(fromChain)}`, state: 'pending', chainKey: fromChain },
    {
      id: 'deliver',
      label: fromChain === ChainKeys.SONIC_MAINNET ? 'Recorded on Sonic' : 'Deliver to Sonic',
      state: 'pending',
      chainKey: ChainKeys.SONIC_MAINNET,
    },
    {
      id: 'fill',
      label: `Solver pays out ${tokenSymbol} on ${chainName(dstChain)}`,
      detail: 'Usually under 2 minutes.',
      state: 'pending',
      chainKey: dstChain,
    },
  ];
}

const PERCENTS = [25, 50, 75, 100] as const;

export function WithdrawDialog({
  meta,
  initialChain,
  open,
  onOpenChange,
}: {
  meta: VaultMeta;
  initialChain?: SourceChainKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const vault = meta.vault.vault;
  const holdings = useShareHoldings(vault, useEvmWallet().address);
  const heldChains = holdings.rows.map(r => r.chainKey as SourceChainKey);
  const [fromChain, setFromChain] = useState<SourceChainKey | undefined>(initialChain ?? heldChains[0]);
  const [dstChain, setDstChain] = useState<SourceChainKey | undefined>(initialChain ?? heldChains[0]);
  const [tokenAddress, setTokenAddress] = useState<string>();
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [phase, setPhase] = useState<Phase>('form');
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string>();
  const [delivery, setDelivery] = useState<Delivery>();
  const [sentMin, setSentMin] = useState<bigint>();

  // Holdings load after the dialog mounts; pick the first network that holds shares.
  useEffect(() => {
    if (!fromChain && heldChains[0]) {
      setFromChain(heldChains[0]);
      setDstChain(d => d ?? heldChains[0]);
    }
  }, [fromChain, heldChains]);

  const signChain = fromChain ?? ChainKeys.BASE_MAINNET;
  const outChain = dstChain ?? signChain;
  const wallet = useEvmWallet(signChain);
  const { address, walletProvider } = wallet;

  const available = fromChain ? sharesOn(holdings, fromChain) : 0n;
  const shares = parseTokenAmount(amount, SHARE_DECIMALS);
  const tooMuch = shares !== undefined && shares > available;

  const tokens = useMemo(() => getDepositTokens(outChain), [outChain]);
  const token = tokens.find(t => t.address === tokenAddress) ?? getTokenByKey(outChain, DEFAULT_TOKEN_KEY) ?? tokens[0];

  const stats = useVaultStats(vault);
  const priceOf = useUsdPrice();

  const quotePayload = useMemo(
    () =>
      token && shares && shares > 0n && !tooMuch
        ? {
            token_src: vault,
            token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
            token_dst: token.address,
            token_dst_blockchain_id: outChain,
            amount: shares,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [token, shares, tooMuch, vault, outChain],
  );
  const quote = useVaultQuote(phase === 'form' ? quotePayload : undefined, slippageBps);

  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();

  const fill = useFillStatus(delivery);
  useEffect(() => {
    if (fill.phase === 'filled') {
      setSteps(s => setStep(s, 'fill', { state: 'done', hash: fill.fillTxHash, detail: undefined }));
    } else if (fill.phase === 'failed') {
      setSteps(s => setStep(s, 'fill', { state: 'error', detail: fill.message }));
    } else if (fill.phase === 'timeout') {
      setSteps(s =>
        setStep(s, 'fill', {
          state: 'error',
          detail: 'Still not filled after 10 minutes. If it expires, your shares stay in your hub wallet.',
        }),
      );
    }
  }, [fill]);

  function changeDstChain(chainKey: SourceChainKey) {
    setDstChain(chainKey);
    const sameSymbol = getDepositTokens(chainKey).find(t => t.symbol === token?.symbol);
    setTokenAddress(sameSymbol?.address);
  }

  function setPercent(pct: number) {
    setAmount(formatUnits((available * BigInt(pct)) / 100n, SHARE_DECIMALS));
  }

  async function submit() {
    if (!walletProvider || !address || !fromChain || !token || !shares || quote.minOutput === undefined) return;
    const minOutputAmount = quote.minOutput;
    setSentMin(minOutputAmount);
    let current = planSteps(fromChain, outChain, token.symbol);
    const update = (id: string, patch: Partial<Step>) => {
      current = setStep(current, id, patch);
      setSteps(current);
    };
    setSteps(current);
    setError(undefined);
    setPhase('signing');

    // No approval: the hub wallet authorises spending its shares.
    const built = await buildWithdraw({
      vault,
      srcChainKey: fromChain,
      srcAddress: address,
      dstChainKey: outChain,
      outputToken: token.address,
      inputAmount: shares,
      minOutputAmount,
    });
    if (!built.ok) {
      update('sign', { state: 'error' });
      return setError(describeError(built.error));
    }

    update('sign', { state: 'active', detail: 'Confirm the withdraw in your wallet.' });
    const result = await vaultSwap({ ...built.value, walletProvider });
    if (!result.ok) {
      if (isUserRejectedError(result.error)) return backToForm();
      update('sign', { state: 'error' });
      return setError(describeError(result.error));
    }
    const info = result.value.intentDeliveryInfo;
    update('sign', { state: 'done', hash: info.srcTxHash, detail: undefined });
    update('deliver', { state: 'done', hash: info.dstTxHash });
    update('fill', { state: 'active' });
    setDelivery({ srcChainKey: fromChain, srcTxHash: info.srcTxHash, startedAt: Date.now() });
    setPhase('tracking');
  }

  function backToForm() {
    setPhase('form');
    setSteps([]);
  }

  const burnAssets = shares && stats.pricePerShare !== undefined ? shareValue(shares, stats.pricePerShare) : undefined;
  const burnUsd = toUsd(burnAssets, meta.assetDecimals, priceOf(meta.vault.asset));
  const receiveUsd = toUsd(quote.quoted, token?.decimals ?? 18, priceOf(token?.vault));
  const done = fill.phase === 'filled';

  return (
    <Dialog open={open} onOpenChange={next => (phase === 'signing' ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Withdraw from {meta.shareSymbol}</DialogTitle>
          <DialogDescription>
            Swap your shares back to a token on the network you choose. Signed from the network that deposited.
          </DialogDescription>
        </DialogHeader>

        {heldChains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {holdings.isLoading ? 'Loading your shares…' : `You hold no ${meta.shareSymbol} shares.`}
          </p>
        ) : phase === 'form' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Shares held on</FieldLabel>
              <ChainSelect
                label="Network holding the shares"
                value={signChain}
                chains={heldChains}
                onChange={c => {
                  setFromChain(c);
                  setAmount('');
                }}
                suffix={c => `${formatTokenAmount(sharesOn(holdings, c), SHARE_DECIMALS)} shares`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                aside={
                  <span className="normal-case tracking-normal">
                    Available {formatTokenAmount(available, SHARE_DECIMALS, 6)}
                  </span>
                }
              >
                Shares to withdraw
              </FieldLabel>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-14 pr-24 text-2xl font-semibold tabular-nums"
                  aria-invalid={tooMuch}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {burnUsd !== undefined ? `≈ ${formatUsd(burnUsd)}` : 'shares'}
                </span>
              </div>
              <div className="flex gap-1.5">
                {PERCENTS.map(p => (
                  <Button
                    key={p}
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 px-2 text-xs"
                    onClick={() => setPercent(p)}
                  >
                    {p === 100 ? 'Max' : `${p}%`}
                  </Button>
                ))}
              </div>
              {tooMuch && (
                <p className="text-xs text-destructive">More than the shares held on {chainName(signChain)}.</p>
              )}
            </div>

            <div className="flex justify-center text-subtle-foreground">
              <ArrowDownIcon className="size-4" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Receive on</FieldLabel>
                <ChainSelect label="Destination network" value={outChain} onChange={changeDstChain} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Token</FieldLabel>
                <TokenSelect label="Output token" tokens={tokens} value={token?.address} onChange={setTokenAddress} />
              </div>
            </div>

            <div className="rounded-lg border bg-secondary/60 p-4">
              <div className="flex items-center justify-between">
                <FieldLabel>You receive</FieldLabel>
                {quote.isFetching && <RefreshCwIcon className="size-3 animate-spin text-subtle-foreground" />}
              </div>
              {!quotePayload ? (
                <p className="mt-1 text-sm text-muted-foreground">Enter how many shares to get a live quote.</p>
              ) : quote.isLoading ? (
                <Skeleton className="mt-2 h-8 w-40" />
              ) : quote.error ? (
                <div className="mt-1 flex items-center justify-between gap-2 text-sm text-destructive">
                  <span>{quote.error}</span>
                  <Button size="sm" variant="ghost" onClick={quote.refetch}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    ≈ {formatTokenAmount(quote.quoted, token?.decimals ?? 18, 6)}{' '}
                    <span className="text-base font-medium text-muted-foreground">{token?.symbol}</span>
                  </p>
                  <div className="mt-2 divide-y divide-border/60">
                    <SummaryRow label="Value">{formatUsd(receiveUsd)}</SummaryRow>
                    <SummaryRow
                      label="Minimum you accept"
                      hint="If a solver can't pay at least this much before the deadline, the withdraw isn't filled and your shares stay put."
                    >
                      {formatTokenAmount(quote.minOutput, token?.decimals ?? 18, 6)} {token?.symbol}
                    </SummaryRow>
                    <SummaryRow label="Slippage tolerance">
                      <SlippagePicker value={slippageBps} onChange={setSlippageBps} />
                    </SummaryRow>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>What you'll sign</FieldLabel>
              <StepList steps={planSteps(signChain, outChain, token?.symbol ?? '')} />
            </div>

            {!wallet.isConnected ? (
              <Button size="lg" onClick={wallet.connect}>
                Connect wallet
              </Button>
            ) : wallet.isWrongChain ? (
              <Button size="lg" onClick={wallet.switchChain}>
                Switch to {chainName(signChain)}
              </Button>
            ) : (
              <Button size="lg" disabled={quote.minOutput === undefined || tooMuch} onClick={submit}>
                {!shares
                  ? 'Enter an amount'
                  : tooMuch
                    ? 'Not enough shares'
                    : quote.minOutput === undefined
                      ? 'No quote yet'
                      : 'Withdraw'}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-secondary/60 p-4 text-sm">
              <SummaryRow label="Withdrawing">
                {amount} {meta.shareSymbol}
              </SummaryRow>
              <SummaryRow label="Minimum">
                {formatTokenAmount(sentMin, token?.decimals ?? 18, 6)} {token?.symbol} on {chainName(outChain)}
              </SummaryRow>
            </div>
            <StepList steps={steps} />
            {error && <Callout variant="destructive">{error}</Callout>}
            {done && (
              <Callout variant="success" className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4" /> Withdraw complete. {token?.symbol} is on its way to your wallet
                on {chainName(outChain)}.
              </Callout>
            )}
            <div className="flex gap-2">
              {(error || fill.phase === 'failed') && (
                <Button variant="outline" className="flex-1" onClick={backToForm}>
                  Back
                </Button>
              )}
              {phase === 'tracking' && (
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  {done ? 'Done' : 'Close'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
