import { useLeverageYieldQuote, useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import type { LeverageYieldQuoteParams } from '@sodax/sdk';
import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { CheckCircle2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_TOKEN_KEY, getDepositTokens, getTokenByKey, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { ChainSelect, quoteErrorText, TokenSelect } from './pickers';
import { SlippageControl, useSlippage } from './SlippageControl';
import { TxSteps } from './TxSteps';
import { useVaultSwapFlow } from './useVaultSwapFlow';

export type WithdrawTarget = { vault: LeverageYieldVault; srcChainKey: SourceChainKey; shares: bigint };

export function WithdrawDialog({ target, onClose }: { target: WithdrawTarget | undefined; onClose: () => void }) {
  const flow = useVaultSwapFlow('withdraw');
  return (
    <Dialog
      open={target !== undefined}
      onOpenChange={open => {
        // Closing mid-flight is fine: the intent keeps going. We only reset the local view.
        if (!open) {
          if (!flow.busy) flow.reset();
          onClose();
        }
      }}
    >
      <DialogContent>{target && <WithdrawForm target={target} flow={flow} />}</DialogContent>
    </Dialog>
  );
}

function WithdrawForm({ target, flow }: { target: WithdrawTarget; flow: ReturnType<typeof useVaultSwapFlow> }) {
  const { vault, srcChainKey, shares: maxShares } = target;
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(srcChainKey);
  const tokens = useMemo(() => getDepositTokens(dstChainKey), [dstChainKey]);
  const [tokenAddress, setTokenAddress] = useState(() => getTokenByKey(srcChainKey, DEFAULT_TOKEN_KEY)?.address);
  const token = tokens.find(t => t.address === tokenAddress) ?? tokens[0];
  const [amount, setAmount] = useState(() => formatTokenAmount(maxShares, 18, 18).replace(/,/g, ''));
  const [slippageBps, setSlippageBps] = useSlippage();

  // The hub wallet holding these shares is derived from srcChainKey, so the user signs there.
  const wallet = useEvmWallet(srcChainKey);
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();

  useEffect(() => {
    if (tokens.some(t => t.address === tokenAddress)) return;
    const sameSymbol = tokens.find(t => t.symbol === token?.symbol);
    setTokenAddress((sameSymbol ?? getTokenByKey(dstChainKey, DEFAULT_TOKEN_KEY) ?? tokens[0])?.address);
  }, [dstChainKey, tokens, tokenAddress, token?.symbol]);

  const shares = parseTokenAmount(amount, 18);
  const tooMuch = shares !== undefined && shares > maxShares;

  const quotePayload = useMemo<LeverageYieldQuoteParams | undefined>(() => {
    if (!token || !shares || shares <= 0n || shares > maxShares) return undefined;
    return {
      token_src: vault.vault,
      token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
      token_dst: token.address,
      token_dst_blockchain_id: dstChainKey,
      amount: shares,
      quote_type: 'exact_input',
    };
  }, [vault.vault, token, shares, maxShares, dstChainKey]);

  const quoteQuery = useLeverageYieldQuote({ params: { payload: quotePayload } });
  const quoteResult = quotePayload ? quoteQuery.data : undefined;
  const quoted = quoteResult?.ok ? quoteResult.value.quoted_amount : undefined;
  const minOut = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const quoteLoading = quotePayload !== undefined && quoteQuery.isLoading;

  if (!token) return null;
  const locked = flow.busy || flow.state.stage === 'done';

  const submit = () => {
    if (!wallet.walletProvider || !wallet.address || !shares || minOut === undefined || minOut <= 0n) return;
    const { walletProvider, address } = wallet;
    void flow.run({
      srcChainKey,
      walletProvider,
      checkApproval: false,
      build: () =>
        buildWithdraw({
          vault: vault.vault,
          srcChainKey,
          srcAddress: address,
          dstChainKey,
          outputToken: token.address,
          inputAmount: shares,
          minOutputAmount: minOut,
        }),
    });
  };

  let cta = 'Withdraw';
  if (!wallet.isConnected) cta = 'Connect wallet';
  else if (wallet.isWrongChain) cta = `Switch to ${chainName(srcChainKey)} to sign`;
  else if (!shares) cta = 'Enter an amount';
  else if (tooMuch) cta = 'More than you hold';
  else if (quoteLoading) cta = 'Fetching quote…';
  else if (minOut === undefined) cta = 'No quote';
  else if (flow.busy) cta = 'Withdrawing…';

  const canSubmit = !locked && !tooMuch && minOut !== undefined && minOut > 0n;
  const onCta = () => {
    if (!wallet.isConnected) return wallet.connect();
    if (wallet.isWrongChain) return wallet.switchChain();
    submit();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Withdraw {vault.name}</DialogTitle>
        <DialogDescription>
          Shares from your {chainName(srcChainKey)} deposits. You sign on {chainName(srcChainKey)}; no approval needed.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 rounded-lg border bg-secondary/40 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Shares to withdraw</span>
          <span>Available: {formatTokenAmount(maxShares, 18)}</span>
        </div>
        <Input
          inputMode="decimal"
          aria-label="Shares to withdraw"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={locked}
          className="h-12 text-xl font-semibold tabular-nums"
        />
        <div className="flex gap-1">
          {[25n, 50n, 75n, 100n].map(pct => (
            <button
              key={pct.toString()}
              type="button"
              disabled={locked}
              onClick={() => setAmount(formatTokenAmount((maxShares * pct) / 100n, 18, 18).replace(/,/g, ''))}
              className="flex-1 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
            >
              {pct === 100n ? 'Max' : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Receive on</span>
        <div className="grid grid-cols-2 gap-2">
          <ChainSelect value={dstChainKey} onChange={setDstChainKey} disabled={locked} />
          <TokenSelect tokens={tokens} value={token.address} onChange={setTokenAddress} disabled={locked} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">You receive (est.)</span>
          {quoteLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="font-semibold tabular-nums">
              {quoted !== undefined ? `${formatTokenAmount(quoted, token.decimals)} ${token.symbol}` : '–'}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Minimum accepted</span>
          <span className="tabular-nums">
            {minOut !== undefined ? `${formatTokenAmount(minOut, token.decimals)} ${token.symbol}` : '–'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Slippage</span>
          <SlippageControl value={slippageBps} onChange={setSlippageBps} disabled={locked} />
        </div>
        {quoteResult && !quoteResult.ok && (
          <p className="text-xs text-destructive">{quoteErrorText(quoteResult.error)}</p>
        )}
      </div>

      <Button size="lg" onClick={onCta} disabled={wallet.isConnected && !wallet.isWrongChain && !canSubmit}>
        {cta}
      </Button>

      {flow.state.stage !== 'idle' && <TxSteps steps={flow.steps} />}
      {flow.state.stage === 'failed' && <Callout variant="destructive">{flow.state.error}</Callout>}
      {flow.state.stage === 'done' && (
        <Callout variant="success" className="flex items-center gap-2">
          <CheckCircle2Icon className="size-4 shrink-0" />
          Withdrawal filled. {token.symbol} is on its way to your wallet on {chainName(dstChainKey)}.
        </Callout>
      )}
    </>
  );
}
