import { useLeverageYieldQuote, useLeverageYieldVaultSwap, useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldSwapPayload } from '@sodax/sdk';
import { Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  isSourceChain,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { actionErrorMessage, quoteErrorMessage } from './errors';
import { FlowSteps } from './FlowSteps';
import { ChainBadge, ChainSelect, TokenSelect, VaultSelect } from './pickers';
import { SlippageControl } from './SlippageControl';
import { useVaultShares } from './shares';
import { type FlowState, initialFlow, useTrackFill } from './useTrackedFlow';
import type { VaultInfo } from './vaults';

type Review = { payload: LeverageYieldSwapPayload; quoted: bigint; minimum: bigint; shares: bigint };

export function WithdrawCard({
  vaults,
  vaultName,
  onVaultChange,
}: {
  vaults: VaultInfo[];
  vaultName: string;
  onVaultChange: (name: string) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const { address } = useEvmWallet();
  const { holdings, total } = useVaultShares(vault?.vault, address);
  const funded = holdings.filter(h => h.shares > 0n && isSourceChain(h.chainKey));

  // Shares are spent from the hub wallet of the network that deposited, so the withdraw is signed there.
  const [srcChainKey, setSrcChainKey] = useState<SourceChainKey>(SOURCE_CHAINS[0]);
  useEffect(() => {
    const first = funded[0]?.chainKey;
    if (first && isSourceChain(first) && !funded.some(h => h.chainKey === srcChainKey)) setSrcChainKey(first);
  }, [funded, srcChainKey]);
  const held = holdings.find(h => h.chainKey === srcChainKey)?.shares ?? 0n;
  const wallet = useEvmWallet(srcChainKey);

  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(SOURCE_CHAINS[0]);
  const tokens = useMemo(() => getDepositTokens(dstChainKey), [dstChainKey]);
  const [tokenAddress, setTokenAddress] = useState(
    () => getTokenByKey(SOURCE_CHAINS[0], DEFAULT_TOKEN_KEY)?.address ?? '',
  );
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const changeDst = (next: SourceChainKey) => {
    setDstChainKey(next);
    const same = getDepositTokens(next).find(t => t.symbol === token?.symbol);
    setTokenAddress(same?.address ?? getTokenByKey(next, DEFAULT_TOKEN_KEY)?.address ?? '');
  };

  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const parsed = parseTokenAmount(amount, 18);
  const shares = parsed !== undefined && parsed > 0n ? parsed : undefined;
  const tooMuch = shares !== undefined && shares > held;

  // Quote: vault as token_src on Sonic.
  const quote = useLeverageYieldQuote({
    params: {
      payload:
        shares && !tooMuch && token && vault
          ? {
              token_src: vault.vault,
              token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
              token_dst: token.address,
              token_dst_blockchain_id: dstChainKey,
              amount: shares,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quoted = quote.data?.ok ? quote.data.value.quoted_amount : undefined;
  const minimum = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;

  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const [preparing, setPreparing] = useState(false);
  // An error belongs to the inputs it was raised for; editing the form clears it.
  const formKey = `${amount}|${srcChainKey}|${dstChainKey}|${tokenAddress}|${vaultName}`;
  const [error, setError] = useState<{ key: string; message?: string }>();
  const formError = error?.key === formKey ? error.message : undefined;
  const setFormError = (message?: string) => setError({ key: formKey, message });
  const [review, setReview] = useState<Review>();
  const [flow, setFlowState] = useState<FlowState>();
  const [open, setOpen] = useState(false);
  const setFlow = useCallback((update: (f: FlowState) => FlowState) => setFlowState(f => (f ? update(f) : f)), []);
  useTrackFill(flow, setFlow, dstChainKey);

  const prepare = async () => {
    if (!wallet.address || !shares || !token || !vault || quoted === undefined || !minimum) return;
    setPreparing(true);
    setFormError(undefined);
    try {
      const built = await buildWithdraw({
        vault: vault.vault,
        srcChainKey,
        srcAddress: wallet.address,
        dstChainKey,
        outputToken: token.address,
        inputAmount: shares,
        minOutputAmount: minimum,
      });
      if (!built.ok) return setFormError(actionErrorMessage(built.error));
      setReview({ payload: built.value, quoted, minimum, shares });
      setFlowState(undefined);
      setOpen(true);
    } finally {
      setPreparing(false);
    }
  };

  const execute = async () => {
    const walletProvider = wallet.walletProvider;
    if (!review || !walletProvider) return;
    setFlowState({ ...initialFlow(false), sign: { state: 'active', chainKey: srcChainKey } });
    const result = await vaultSwap({ ...review.payload, walletProvider });
    if (!result.ok) {
      const message = actionErrorMessage(result.error);
      if (!message) return setFlowState(undefined);
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
  const close = () => {
    setOpen(false);
    setFlowState(undefined);
    if (done) setAmount('');
  };

  let action: { label: string; onClick?: () => void; disabled?: boolean };
  if (!wallet.isConnected) action = { label: 'Connect wallet', onClick: wallet.connect };
  else if (held === 0n) action = { label: 'No shares on this network', disabled: true };
  else if (wallet.isWrongChain) action = { label: `Switch to ${chainName(srcChainKey)}`, onClick: wallet.switchChain };
  else if (!shares) action = { label: 'Enter an amount', disabled: true };
  else if (tooMuch) action = { label: 'More than your shares', disabled: true };
  else if (quote.isLoading) action = { label: 'Fetching quote…', disabled: true };
  else if (!minimum) action = { label: 'No quote', disabled: true };
  else action = { label: preparing ? 'Preparing…' : 'Review withdraw', onClick: prepare, disabled: preparing };

  if (!vault) return null;

  return (
    <Card id="withdraw">
      <CardHeader>
        <CardTitle>Withdraw</CardTitle>
        <CardDescription>Redeem shares to a token on the network you choose.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wd-vault" className="text-sm font-medium">
            Vault
          </label>
          <VaultSelect id="wd-vault" value={vault.name} onChange={onVaultChange} vaults={vaults} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Shares held (sign on the network that deposited)</span>
          {!address ? (
            <p className="text-sm text-muted-foreground">Connect your wallet to see your shares.</p>
          ) : total === 0n ? (
            <p className="text-sm text-muted-foreground">You hold no {vault.shareSymbol} yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {funded.map(h => (
                <button
                  key={h.chainKey}
                  type="button"
                  onClick={() => isSourceChain(h.chainKey) && setSrcChainKey(h.chainKey)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    h.chainKey === srcChainKey ? 'border-primary bg-secondary' : 'hover:bg-secondary'
                  }`}
                >
                  <ChainBadge chainKey={h.chainKey} />
                  <span className="block font-semibold">{formatTokenAmount(h.shares, 18)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="wd-amount" className="text-sm font-medium">
              Shares to withdraw
            </label>
            {held > 0n && (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => setAmount(formatTokenAmount(held, 18, 18).replace(/,/g, ''))}
              >
                Max
              </button>
            )}
          </div>
          <Input
            id="wd-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wd-chain" className="text-sm font-medium">
              To network
            </label>
            <ChainSelect id="wd-chain" value={dstChainKey} onChange={changeDst} chains={SOURCE_CHAINS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wd-token" className="text-sm font-medium">
              Receive
            </label>
            <TokenSelect id="wd-token" value={token?.address ?? ''} onChange={setTokenAddress} tokens={tokens} />
          </div>
        </div>

        <div className="rounded-md bg-secondary p-4 text-sm">
          {quote.isLoading && shares ? (
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
          ) : quoted !== undefined && minimum !== undefined && token ? (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">
              <dt className="text-muted-foreground">You receive ≈</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(quoted, token.decimals)} {token.symbol}
              </dd>
              <dt className="text-muted-foreground">Minimum you accept</dt>
              <dd className="text-right">
                {formatTokenAmount(minimum, token.decimals)} {token.symbol}
              </dd>
            </dl>
          ) : (
            <span className="text-muted-foreground">Enter an amount of shares to see a live quote.</span>
          )}
        </div>

        <SlippageControl value={slippageBps} onChange={setSlippageBps} />
        {formError && <Callout variant="destructive">{formError}</Callout>}
        <Button size="lg" variant="secondary" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next && running && flow?.sign.state !== 'done') return;
          if (!next) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{done ? 'Withdraw complete' : 'Confirm withdraw'}</DialogTitle>
            <DialogDescription>
              {vault.shareSymbol} → {token?.symbol} on {chainName(dstChainKey)}
            </DialogDescription>
          </DialogHeader>
          {review && token && (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-md bg-secondary p-4 text-sm">
              <dt className="text-muted-foreground">You redeem</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(review.shares, 18)} {vault.shareSymbol}
              </dd>
              <dt className="text-muted-foreground">You receive ≈</dt>
              <dd className="text-right font-semibold">
                {formatTokenAmount(review.quoted, token.decimals)} {token.symbol}
              </dd>
              <dt className="text-muted-foreground">Minimum you accept</dt>
              <dd className="text-right">
                {formatTokenAmount(review.minimum, token.decimals)} {token.symbol}
              </dd>
            </dl>
          )}
          <FlowSteps
            flow={flow ?? initialFlow(false)}
            labels={{
              sign: `Sign the withdraw on ${chainName(srcChainKey)}`,
              fill: `Solver fills; ${token?.symbol ?? 'tokens'} paid out on ${chainName(dstChainKey)}`,
            }}
          />
          {flow?.error && <Callout variant="destructive">{flow.error}</Callout>}
          {done && (
            <Callout variant="success">Withdrawn. Funds were paid to your wallet on {chainName(dstChainKey)}.</Callout>
          )}
          {!flow ? (
            <Button size="lg" onClick={execute}>
              Withdraw
            </Button>
          ) : done || flow.error ? (
            <Button size="lg" variant="secondary" onClick={close}>
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
