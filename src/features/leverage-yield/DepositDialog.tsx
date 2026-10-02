import {
  isUserRejectedError,
  useLeverageYieldDeposit,
  useLeverageYieldVaultSwap,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/sdk';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownIcon, CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits, isHex } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  isSourceChain,
  REFETCH_MS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatRayPercent, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { isNativeToken, spendable, useTokenBalances } from './balances';
import { type Delivery, describeError, type Step, setStep, useFillStatus, useVaultQuote } from './flow';
import { ChainSelect, FieldLabel, formatUsd, SlippagePicker, StepList, SummaryRow, TokenSelect } from './parts';
import { RiskNotice } from './RiskNotice';
import { SHARE_DECIMALS, shareValue, toUsd, useUsdPrice, useVaultStats, type VaultMeta } from './vaults';

type Phase = 'form' | 'signing' | 'tracking';

function planSteps(
  meta: VaultMeta,
  srcChainKey: SourceChainKey,
  tokenSymbol: string,
  approve: boolean | undefined,
): Step[] {
  const fromSonic = srcChainKey === ChainKeys.SONIC_MAINNET;
  return [
    {
      id: 'approve',
      label: `Approve ${tokenSymbol}`,
      detail:
        approve === undefined
          ? 'Only if your allowance is short. Some tokens ask twice.'
          : approve
            ? 'Allowance for this amount. Some tokens ask twice.'
            : 'Not needed.',
      state: approve === false ? 'skipped' : 'pending',
      chainKey: srcChainKey,
    },
    { id: 'sign', label: `Sign the deposit on ${chainName(srcChainKey)}`, state: 'pending', chainKey: srcChainKey },
    {
      id: 'deliver',
      label: fromSonic ? 'Recorded on Sonic' : 'Deliver to Sonic',
      state: 'pending',
      chainKey: ChainKeys.SONIC_MAINNET,
    },
    {
      id: 'fill',
      label: `Solver fills; ${meta.shareSymbol} land in your hub wallet`,
      detail: 'Usually under 2 minutes.',
      state: 'pending',
      chainKey: ChainKeys.SONIC_MAINNET,
    },
  ];
}

export function DepositDialog({
  meta,
  open,
  onOpenChange,
}: {
  meta: VaultMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { sodax } = useSodaxContext();
  const vault = meta.vault.vault;

  const initialChain = DEFAULT_SOURCE_CHAIN;
  const [srcChainKey, setSrcChainKey] = useState<SourceChainKey>(initialChain);
  const [tokenAddress, setTokenAddress] = useState(getTokenByKey(initialChain, DEFAULT_TOKEN_KEY)?.address);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [accepted, setAccepted] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string>();
  const [delivery, setDelivery] = useState<Delivery>();
  const [sentMin, setSentMin] = useState<bigint>();

  const wallet = useEvmWallet(srcChainKey);
  const { address, walletProvider } = wallet;

  // Start on the network the wallet is already on, when it's a supported source.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the dialog opens
  useEffect(() => {
    if (open && phase === 'form' && isSourceChain(wallet.currentChainKey) && amount === '') {
      changeChain(wallet.currentChainKey);
    }
  }, [open]);

  const tokens = useMemo(() => getDepositTokens(srcChainKey), [srcChainKey]);
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const { balances } = useTokenBalances(srcChainKey, tokens, address);
  const balance = token ? balances?.[token.address] : undefined;
  const maxSpend = spendable(token, balance, srcChainKey);
  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;
  const insufficient = inputAmount !== undefined && balance !== undefined && inputAmount > maxSpend;

  const priceOf = useUsdPrice();
  const stats = useVaultStats(vault);

  const quotePayload = useMemo(
    () =>
      token && inputAmount && inputAmount > 0n
        ? {
            token_src: token.address,
            token_src_blockchain_id: srcChainKey,
            token_dst: vault,
            token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
            amount: inputAmount,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [token, inputAmount, srcChainKey, vault],
  );
  const quote = useVaultQuote(phase === 'form' ? quotePayload : undefined, slippageBps);

  // Does this amount need an approval? Shown as a planned step before signing; checked again on submit.
  const needsApproval = useQuery({
    queryKey: [
      'leverage-yield-ui',
      'depositApproval',
      vault,
      srcChainKey,
      token?.address,
      String(inputAmount),
      address,
    ],
    enabled:
      phase === 'form' &&
      !!walletProvider &&
      !!address &&
      !!token &&
      !isNativeToken(token) &&
      !!inputAmount &&
      quote.minOutput !== undefined,
    queryFn: async () => {
      if (!walletProvider || !address || !token || !inputAmount || quote.minOutput === undefined) return false;
      const built = await sodax.leverageYield.deposit({
        vault,
        srcChainKey,
        srcAddress: address,
        inputToken: token.address,
        inputAmount,
        minOutputAmount: quote.minOutput,
      });
      if (!built.ok) throw built.error;
      const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, walletProvider });
      if (!allowance.ok) throw allowance.error;
      return !allowance.value;
    },
    refetchInterval: REFETCH_MS,
  });
  const approvalPlanned = isNativeToken(token) ? false : needsApproval.data;

  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
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
          detail: 'Still not filled after 10 minutes. Check "Your positions" later; your funds are not lost.',
        }),
      );
    }
  }, [fill]);

  function changeChain(chainKey: SourceChainKey) {
    setSrcChainKey(chainKey);
    const sameSymbol = getDepositTokens(chainKey).find(t => t.symbol === token?.symbol);
    setTokenAddress(
      (sameSymbol ?? getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ?? getDepositTokens(chainKey)[0])?.address,
    );
  }

  async function submit() {
    if (!walletProvider || !address || !token || !inputAmount || quote.minOutput === undefined) return;
    const minOutputAmount = quote.minOutput; // the minimum on screen when the user pressed Deposit
    setSentMin(minOutputAmount);
    let current = planSteps(meta, srcChainKey, token.symbol, approvalPlanned);
    const update = (id: string, patch: Partial<Step>) => {
      current = setStep(current, id, patch);
      setSteps(current);
    };
    const fail = (id: string, e: unknown) => {
      update(id, { state: 'error' });
      setError(describeError(e));
    };
    setSteps(current);
    setError(undefined);
    setPhase('signing');

    const built = await buildDeposit({
      vault,
      srcChainKey,
      srcAddress: address,
      inputToken: token.address,
      inputAmount,
      minOutputAmount,
    });
    if (!built.ok) return fail('sign', built.error);

    const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, walletProvider });
    if (!allowance.ok) return fail('approve', allowance.error);
    if (allowance.value) {
      update('approve', { state: 'skipped', detail: 'Not needed.' });
    } else {
      update('approve', { state: 'active', detail: 'Confirm the approval in your wallet.' });
      const approval = await approve({ params: built.value.params, walletProvider });
      if (!approval.ok) {
        if (isUserRejectedError(approval.error)) return backToForm();
        return fail('approve', approval.error);
      }
      const hash = approval.value;
      if (isHex(hash)) {
        update('approve', { hash, detail: 'Waiting for confirmation…' });
        try {
          const receipt = await walletProvider.waitForTransactionReceipt(hash);
          if (receipt.status === 'reverted' || receipt.status === '0x0') return fail('approve', 'Approval reverted.');
        } catch (e) {
          return fail('approve', e);
        }
      }
      update('approve', { state: 'done', detail: undefined });
    }

    update('sign', { state: 'active', detail: 'Confirm the deposit in your wallet.' });
    const result = await vaultSwap({ ...built.value, walletProvider });
    if (!result.ok) {
      if (isUserRejectedError(result.error)) return backToForm();
      return fail('sign', result.error);
    }
    const info = result.value.intentDeliveryInfo;
    update('sign', { state: 'done', hash: info.srcTxHash, detail: undefined });
    update('deliver', { state: 'done', hash: info.dstTxHash });
    update('fill', { state: 'active' });
    setDelivery({ srcChainKey, srcTxHash: info.srcTxHash, startedAt: Date.now() });
    setPhase('tracking');
  }

  function backToForm() {
    setPhase('form');
    setSteps([]);
  }

  const quotedAssets =
    quote.quoted !== undefined && stats.pricePerShare !== undefined
      ? shareValue(quote.quoted, stats.pricePerShare)
      : undefined;
  const inputUsd = toUsd(inputAmount, token?.decimals ?? 18, priceOf(token?.vault));
  const receiveUsd = toUsd(quotedAssets, meta.assetDecimals, priceOf(meta.vault.asset));
  const yearlyUsd =
    receiveUsd !== undefined && stats.apr
      ? (receiveUsd * Number((stats.apr.effectiveNetAprRay * 10_000n) / 10n ** 27n)) / 10_000
      : undefined;

  const done = fill.phase === 'filled';
  const shownSteps = phase === 'form' ? planSteps(meta, srcChainKey, token?.symbol ?? '', approvalPlanned) : steps;

  return (
    <Dialog open={open} onOpenChange={next => (phase === 'signing' ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Deposit into {meta.shareSymbol}</DialogTitle>
          <DialogDescription>
            Any supported token, from any supported network. You receive {meta.shareSymbol} vault shares (leveraged{' '}
            {meta.assetSymbol}).
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>From network</FieldLabel>
                <ChainSelect label="Source network" value={srcChainKey} onChange={changeChain} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Token</FieldLabel>
                <TokenSelect label="Token" tokens={tokens} value={token?.address} onChange={setTokenAddress} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                aside={
                  address && token ? (
                    <button
                      type="button"
                      className="normal-case tracking-normal hover:text-primary"
                      onClick={() => setAmount(formatUnits(maxSpend, token.decimals))}
                    >
                      Balance {formatTokenAmount(balance, token.decimals)} {token.symbol}
                      <span className="ml-1 font-semibold text-primary">Max</span>
                    </button>
                  ) : null
                }
              >
                Amount
              </FieldLabel>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-14 pr-24 text-2xl font-semibold tabular-nums"
                  aria-invalid={insufficient}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {inputUsd !== undefined ? `≈ ${formatUsd(inputUsd)}` : token?.symbol}
                </span>
              </div>
              {insufficient && <p className="text-xs text-destructive">Not enough {token?.symbol} (gas kept aside).</p>}
            </div>

            <div className="flex justify-center text-subtle-foreground">
              <ArrowDownIcon className="size-4" />
            </div>

            <div className="rounded-lg border bg-secondary/60 p-4">
              <div className="flex items-center justify-between">
                <FieldLabel>You receive</FieldLabel>
                {quote.isFetching && <RefreshCwIcon className="size-3 animate-spin text-subtle-foreground" />}
              </div>
              {!quotePayload ? (
                <p className="mt-1 text-sm text-muted-foreground">Enter an amount to get a live quote.</p>
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
                    ≈ {formatTokenAmount(quote.quoted, SHARE_DECIMALS, 6)}{' '}
                    <span className="text-base font-medium text-muted-foreground">{meta.shareSymbol}</span>
                  </p>
                  <div className="mt-2 divide-y divide-border/60">
                    <SummaryRow label="Worth">
                      {formatTokenAmount(quotedAssets, meta.assetDecimals, 6)} {meta.assetSymbol}{' '}
                      <span className="text-muted-foreground">({formatUsd(receiveUsd)})</span>
                    </SummaryRow>
                    <SummaryRow
                      label="Minimum you accept"
                      hint="If a solver can't deliver at least this many shares before the deadline, the deposit isn't filled."
                    >
                      {formatTokenAmount(quote.minOutput, SHARE_DECIMALS, 6)} {meta.shareSymbol}
                    </SummaryRow>
                    <SummaryRow label="Slippage tolerance">
                      <SlippagePicker value={slippageBps} onChange={setSlippageBps} />
                    </SummaryRow>
                    <SummaryRow
                      label="Est. yearly yield"
                      hint="At today's variable APR. Not guaranteed; it can go negative."
                    >
                      {formatUsd(yearlyUsd)}{' '}
                      <span className="text-muted-foreground">({formatRayPercent(stats.apr?.effectiveNetAprRay)})</span>
                    </SummaryRow>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>What you'll sign</FieldLabel>
              <StepList steps={shownSteps} />
            </div>

            <RiskNotice accepted={accepted} onAcceptedChange={setAccepted} />

            <DepositAction
              wallet={wallet}
              srcChainKey={srcChainKey}
              disabledReason={
                !inputAmount
                  ? 'Enter an amount'
                  : insufficient
                    ? `Insufficient ${token?.symbol}`
                    : quote.minOutput === undefined
                      ? quote.error
                        ? 'No quote'
                        : 'Getting quote…'
                      : !accepted
                        ? 'Accept the risks to continue'
                        : undefined
              }
              onSubmit={submit}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-secondary/60 p-4 text-sm">
              <SummaryRow label="Depositing">
                {amount} {token?.symbol} on {chainName(srcChainKey)}
              </SummaryRow>
              <SummaryRow label="Minimum">
                {formatTokenAmount(sentMin, SHARE_DECIMALS, 6)} {meta.shareSymbol}
              </SummaryRow>
            </div>
            <StepList steps={steps} />
            {error && <Callout variant="destructive">{error}</Callout>}
            {done && (
              <Callout variant="success" className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4" /> Deposit complete. Your shares show under “Your positions”.
              </Callout>
            )}
            {phase === 'tracking' && !done && !error && fill.phase !== 'failed' && (
              <p className="text-center text-xs text-muted-foreground">
                Safe to close this window. The deposit continues; your shares appear when it fills.
              </p>
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

function DepositAction({
  wallet,
  srcChainKey,
  disabledReason,
  onSubmit,
}: {
  wallet: ReturnType<typeof useEvmWallet>;
  srcChainKey: SourceChainKey;
  disabledReason: string | undefined;
  onSubmit: () => void;
}) {
  if (!wallet.isConnected) {
    return (
      <Button size="lg" onClick={wallet.connect}>
        Connect wallet
      </Button>
    );
  }
  if (wallet.isWrongChain) {
    return (
      <Button size="lg" onClick={wallet.switchChain}>
        Switch to {chainName(srcChainKey)}
      </Button>
    );
  }
  return (
    <Button size="lg" disabled={!!disabledReason} onClick={onSubmit}>
      {disabledReason ?? 'Deposit'}
    </Button>
  );
}
