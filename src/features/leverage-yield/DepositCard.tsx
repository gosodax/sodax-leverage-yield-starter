import {
  useLeverageYieldDeposit,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldQuote,
  useLeverageYieldVaultSwap,
  useSodaxContext,
  useSwapApprove,
  useXBalances,
} from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldSwapPayload } from '@sodax/sdk';
import { useXService } from '@sodax/wallet-sdk-react';
import { ArrowDownIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { formatUnits, isHex } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, ONE_SHARE, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { actionErrorMessage, quoteErrorMessage } from './errors';
import { FlowSteps } from './FlowSteps';
import { ChainSelect, TokenSelect, VaultSelect } from './pickers';
import { SlippageControl } from './SlippageControl';
import { type FlowState, initialFlow, useTrackFill } from './useTrackedFlow';
import { formatUsd, type VaultInfo } from './vaults';

const NATIVE = '0x0000000000000000000000000000000000000000';

type Review = { payload: LeverageYieldSwapPayload; needsApproval: boolean; quoted: bigint; minimum: bigint };

export function DepositCard({
  vaults,
  vaultName,
  onVaultChange,
  usdPrice,
}: {
  vaults: VaultInfo[];
  vaultName: string;
  onVaultChange: (name: string) => void;
  usdPrice: (asset: string) => number | undefined;
}) {
  const { sodax } = useSodaxContext();
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [tokenAddress, setTokenAddress] = useState<string>(
    () => getTokenByKey(DEFAULT_SOURCE_CHAIN, DEFAULT_TOKEN_KEY)?.address ?? '',
  );
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const wallet = useEvmWallet(chainKey);

  const changeChain = (next: SourceChainKey) => {
    setChainKey(next);
    const sameSymbol = getDepositTokens(next).find(t => t.symbol === token?.symbol);
    setTokenAddress(sameSymbol?.address ?? getTokenByKey(next, DEFAULT_TOKEN_KEY)?.address ?? '');
  };

  // Balances on the source network.
  const xService = useXService({ xChainType: 'EVM' });
  const { data: balances } = useXBalances({
    params: { xService, xChainId: chainKey, xTokens: tokens, address: wallet.address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = token ? balances?.[token.address] : undefined;
  const spendable =
    balance !== undefined && token?.address === NATIVE
      ? balance > NATIVE_GAS_RESERVE[chainKey]
        ? balance - NATIVE_GAS_RESERVE[chainKey]
        : 0n
      : balance;

  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;
  const validAmount = inputAmount !== undefined && inputAmount > 0n ? inputAmount : undefined;
  const insufficient = validAmount !== undefined && spendable !== undefined && validAmount > spendable;

  // Live quote: vault as token_dst on Sonic. No partner fee here or on the builder.
  const quote = useLeverageYieldQuote({
    params: {
      payload:
        validAmount && token && vault
          ? {
              token_src: token.address,
              token_src_blockchain_id: chainKey,
              token_dst: vault.vault,
              token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
              amount: validAmount,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quoted = quote.data?.ok ? quote.data.value.quoted_amount : undefined;
  const minimum = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;

  const { data: pricePerShare } = useLeverageYieldPreviewRedeem({
    params: { vault: vault?.vault, shares: ONE_SHARE },
  });
  const price = vault ? usdPrice(vault.asset) : undefined;
  const quotedUsd =
    quoted !== undefined && pricePerShare !== undefined && price !== undefined && vault
      ? Number(formatUnits((quoted * pricePerShare) / ONE_SHARE, vault.assetDecimals)) * price
      : undefined;

  // Build → allowance → confirm → approve → execute → track.
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [preparing, setPreparing] = useState(false);
  // An error belongs to the inputs it was raised for; editing the form clears it.
  const formKey = `${amount}|${chainKey}|${tokenAddress}|${vaultName}`;
  const [error, setError] = useState<{ key: string; message?: string }>();
  const formError = error?.key === formKey ? error.message : undefined;
  const setFormError = (message?: string) => setError({ key: formKey, message });
  const [review, setReview] = useState<Review>();
  const [flow, setFlowState] = useState<FlowState>();
  const [open, setOpen] = useState(false);
  const setFlow = useCallback((update: (f: FlowState) => FlowState) => setFlowState(f => (f ? update(f) : f)), []);
  useTrackFill(flow, setFlow, ChainKeys.SONIC_MAINNET);

  const prepare = async () => {
    if (!wallet.address || !wallet.walletProvider || !validAmount || !token || !vault) return;
    if (quoted === undefined || minimum === undefined || minimum === 0n) return; // no quote, no deposit
    setPreparing(true);
    setFormError(undefined);
    try {
      const built = await buildDeposit({
        vault: vault.vault,
        srcChainKey: chainKey,
        srcAddress: wallet.address,
        inputToken: token.address,
        inputAmount: validAmount,
        minOutputAmount: minimum,
      });
      if (!built.ok) return setFormError(actionErrorMessage(built.error));
      const allowance = await sodax.swaps.isAllowanceValid({
        params: built.value.params,
        walletProvider: wallet.walletProvider,
      });
      if (!allowance.ok) return setFormError(actionErrorMessage(allowance.error));
      setReview({ payload: built.value, needsApproval: !allowance.value, quoted, minimum });
      setFlowState(undefined);
      setOpen(true);
    } finally {
      setPreparing(false);
    }
  };

  const execute = async () => {
    const walletProvider = wallet.walletProvider;
    if (!review || !walletProvider) return;
    setFlowState(initialFlow(review.needsApproval));

    if (review.needsApproval) {
      setFlow(f => ({ ...f, approve: { state: 'active', chainKey } }));
      const approval = await approve({ params: review.payload.params, walletProvider });
      if (!approval.ok) {
        const message = actionErrorMessage(approval.error);
        if (!message) return setFlowState(undefined); // rejected: back to the review quietly
        return setFlow(f => ({ ...f, approve: { ...f.approve, state: 'failed' }, error: message }));
      }
      const hash = approval.value;
      if (isHex(hash)) {
        setFlow(f => ({ ...f, approve: { ...f.approve, hash } }));
        try {
          const receipt = await walletProvider.waitForTransactionReceipt(hash);
          if (receipt.status === 'reverted' || receipt.status === '0x0') {
            return setFlow(f => ({ ...f, approve: { ...f.approve, state: 'failed' }, error: 'Approval reverted' }));
          }
        } catch (e) {
          return setFlow(f => ({ ...f, approve: { ...f.approve, state: 'failed' }, error: actionErrorMessage(e) }));
        }
      }
      setFlow(f => ({ ...f, approve: { ...f.approve, state: 'done' } }));
    }

    setFlow(f => ({ ...f, sign: { state: 'active', chainKey } }));
    const result = await vaultSwap({ ...review.payload, walletProvider });
    if (!result.ok) {
      const message = actionErrorMessage(result.error);
      if (!message) return setFlowState(review.needsApproval ? initialFlow(false) : undefined);
      return setFlow(f => ({ ...f, sign: { ...f.sign, state: 'failed' }, error: message }));
    }
    const info = result.value.intentDeliveryInfo;
    setFlow(f => ({
      ...f,
      sign: { state: 'done', hash: info.srcTxHash, chainKey: info.srcChainKey },
      deliver: { state: 'active', hash: info.dstTxHash },
    }));
  };

  const running = !!flow && !flow.error && flow.fill.state !== 'done';
  const done = flow?.fill.state === 'done';

  let action: { label: string; onClick?: () => void; disabled?: boolean } = { label: 'Review deposit' };
  if (!wallet.isConnected) action = { label: 'Connect wallet', onClick: wallet.connect };
  else if (wallet.isWrongChain) action = { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
  else if (!validAmount) action = { label: 'Enter an amount', disabled: true };
  else if (insufficient) action = { label: `Not enough ${token?.symbol}`, disabled: true };
  else if (quote.isLoading) action = { label: 'Fetching quote…', disabled: true };
  else if (minimum === undefined) action = { label: 'No quote', disabled: true };
  else action = { label: preparing ? 'Preparing…' : 'Review deposit', onClick: prepare, disabled: preparing };

  if (!vault) return null;

  return (
    <Card id="deposit">
      <CardHeader>
        <CardTitle>Deposit</CardTitle>
        <CardDescription>
          Deposit from any supported network and token. You receive vault shares on Sonic.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dep-vault" className="text-sm font-medium">
            Vault
          </label>
          <VaultSelect id="dep-vault" value={vault.name} onChange={onVaultChange} vaults={vaults} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dep-chain" className="text-sm font-medium">
              From network
            </label>
            <ChainSelect id="dep-chain" value={chainKey} onChange={changeChain} chains={SOURCE_CHAINS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dep-token" className="text-sm font-medium">
              Token
            </label>
            <TokenSelect id="dep-token" value={token?.address ?? ''} onChange={setTokenAddress} tokens={tokens} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="dep-amount" className="text-sm font-medium">
              Amount
            </label>
            {wallet.isConnected && token && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  spendable !== undefined &&
                  setAmount(formatTokenAmount(spendable, token.decimals, token.decimals).replace(/,/g, ''))
                }
              >
                Balance: {formatTokenAmount(balance, token.decimals)} {token.symbol}
                {spendable !== undefined && spendable > 0n && (
                  <span className="ml-1 font-semibold text-primary">Max</span>
                )}
              </button>
            )}
          </div>
          <Input
            id="dep-amount"
            inputMode="decimal"
            placeholder="5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            aria-invalid={amount !== '' && inputAmount === undefined}
          />
        </div>

        <div className="flex justify-center text-muted-foreground">
          <ArrowDownIcon className="size-4" />
        </div>

        <div className="rounded-md bg-secondary p-4 text-sm">
          {quote.isLoading && validAmount ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Fetching quote…
            </span>
          ) : quote.data && !quote.data.ok ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-destructive">{quoteErrorMessage(quote.data.error)}</span>
              <Button size="sm" variant="outline" onClick={() => quote.refetch()}>
                Retry
              </Button>
            </div>
          ) : quoted !== undefined && minimum !== undefined ? (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">
              <dt className="text-muted-foreground">You receive ≈</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(quoted, 18)} {vault.shareSymbol}
                {quotedUsd !== undefined && (
                  <span className="ml-1 font-normal text-muted-foreground">({formatUsd(quotedUsd)})</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Minimum you accept</dt>
              <dd className="text-right">
                {formatTokenAmount(minimum, 18)} {vault.shareSymbol}
              </dd>
            </dl>
          ) : (
            <span className="text-muted-foreground">Enter an amount to see a live quote.</span>
          )}
        </div>

        <SlippageControl value={slippageBps} onChange={setSlippageBps} />

        {formError && <Callout variant="destructive">{formError}</Callout>}

        <Button size="lg" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next && running && flow?.sign.state !== 'done') return; // keep open while signing
          setOpen(next);
          if (!next && (done || flow?.error)) {
            setFlowState(undefined);
            if (done) setAmount('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{done ? 'Deposit complete' : 'Confirm deposit'}</DialogTitle>
            <DialogDescription>
              {chainName(chainKey)} → {vault.shareSymbol} on Sonic
            </DialogDescription>
          </DialogHeader>
          {review && (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-md bg-secondary p-4 text-sm">
              <dt className="text-muted-foreground">You deposit</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(review.payload.params.inputAmount, token?.decimals ?? 18)} {token?.symbol}
              </dd>
              <dt className="text-muted-foreground">You receive ≈</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(review.quoted, 18)} {vault.shareSymbol}
              </dd>
              <dt className="text-muted-foreground">Minimum you accept</dt>
              <dd className="text-right">
                {formatTokenAmount(review.minimum, 18)} {vault.shareSymbol}
              </dd>
              <dt className="text-muted-foreground">Max slippage</dt>
              <dd className="text-right">{slippageBps / 100}%</dd>
            </dl>
          )}
          <FlowSteps
            flow={flow ?? initialFlow(!!review?.needsApproval)}
            labels={{
              sign: `Sign the deposit on ${chainName(chainKey)}`,
              fill: 'Solver fills; shares land in your hub wallet',
            }}
          />
          {!flow && (
            <Callout>
              Real funds. The vault is leveraged (health factor ~1.2): the APR is variable and can go negative, the
              share price can fall, and the only exit is a withdraw. Shares are held in your SODAX hub wallet on Sonic,
              not in your wallet extension.
            </Callout>
          )}
          {flow?.error && <Callout variant="destructive">{flow.error}</Callout>}
          {done && <Callout variant="success">Your shares have arrived. They appear in “Your positions”.</Callout>}
          {running && flow?.sign.state === 'done' && (
            <p className="text-xs text-muted-foreground">
              Usually under 2 minutes. It is safe to keep this open and wait.
            </p>
          )}
          {!flow ? (
            <Button size="lg" onClick={execute}>
              {review?.needsApproval ? 'Approve and deposit' : 'Deposit'}
            </Button>
          ) : done || flow.error ? (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setFlowState(undefined);
                if (done) setAmount('');
              }}
            >
              Close
            </Button>
          ) : (
            <Button size="lg" disabled>
              <Loader2Icon className="animate-spin" />{' '}
              {flow.sign.state === 'done' ? 'Waiting for fill…' : 'Confirm in your wallet…'}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
