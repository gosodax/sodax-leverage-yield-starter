import { useLeverageYieldWithdraw } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/types';
import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { type FlowStep, FlowSteps, fillStepState } from './FlowSteps';
import { Field, FillOutcome, SummaryRow } from './parts';
import { ChainSelect, TokenSelect } from './pickers';
import { SHARE_DECIMALS } from './units';
import { flowErrorMessage, useVaultFlow, type VaultFlow } from './useVaultFlow';
import { useVaultQuote } from './useVaultQuote';
import type { Holding } from './YourPositions';

/**
 * Withdraw shares held from one network back to a token on a network the user picks. Signed on the network that
 * deposited (its hub wallet holds the shares); no approval, the hub wallet authorises the spend.
 */
export function WithdrawDialog({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const { vault, chainKey: srcChainKey, shares } = holding;
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(srcChainKey);
  const [tokenSymbol, setTokenSymbol] = useState<string>(DEFAULT_TOKEN_KEY);
  const [amount, setAmount] = useState(() => formatUnits(shares, SHARE_DECIMALS));
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string>();
  /** The minimum actually signed, shown after submitting instead of the live quote. */
  const [signedMin, setSignedMin] = useState<bigint>();

  const wallet = useEvmWallet(srcChainKey);
  const flow = useVaultFlow(srcChainKey);
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const started = flow.phase !== 'ready' && flow.phase !== 'error';

  const tokens = useMemo(() => getDepositTokens(dstChainKey), [dstChainKey]);
  const token =
    tokens.find(t => t.symbol === tokenSymbol) ?? getTokenByKey(dstChainKey, DEFAULT_TOKEN_KEY) ?? tokens[0];
  const inputShares = parseTokenAmount(amount, SHARE_DECIMALS);
  const tooMuch = inputShares !== undefined && inputShares > shares;
  const accountChanged = wallet.address !== undefined && wallet.address.toLowerCase() !== holding.address.toLowerCase();

  const payload = useMemo(
    () =>
      // No quoting once submitted: the signed minimum is what matters then.
      !started && token && inputShares && inputShares > 0n && !tooMuch
        ? {
            token_src: vault.vault.vault,
            token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
            token_dst: token.address,
            token_dst_blockchain_id: dstChainKey,
            amount: inputShares,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [started, token, inputShares, tooMuch, vault, dstChainKey],
  );
  const { quote, refresh } = useVaultQuote(payload, DEFAULT_SLIPPAGE_BPS);
  const busy = preparing || flow.busy;

  const withdraw = async () => {
    if (!token || !wallet.address || !wallet.walletProvider || !inputShares) return;
    setPreparing(true);
    setPrepareError(undefined);
    const fresh = await refresh();
    if (fresh.status !== 'ok') {
      setPreparing(false);
      setPrepareError(fresh.status === 'error' ? fresh.message : 'The quote is not ready yet. Try again.');
      return;
    }
    const built = await buildWithdraw({
      vault: vault.vault.vault,
      srcChainKey,
      srcAddress: wallet.address,
      dstChainKey,
      outputToken: token.address,
      inputAmount: inputShares,
      minOutputAmount: fresh.minOutput,
    });
    setPreparing(false);
    if (!built.ok) {
      console.error('[leverage-yield] building the withdraw failed', built.error);
      setPrepareError(flowErrorMessage(built.error));
      return;
    }
    setSignedMin(fresh.minOutput);
    await flow.run({ payload: built.value, walletProvider: wallet.walletProvider, needsApproval: false });
  };

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (accountChanged) return { label: 'Switch back to the account that deposited' };
    if (inputShares === undefined || inputShares === 0n) return { label: 'Enter an amount' };
    if (tooMuch) return { label: 'More than you hold' };
    if (quote.status === 'loading') return { label: 'Getting quote…' };
    if (quote.status !== 'ok') return { label: 'No quote yet' };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(srcChainKey)}`, onClick: wallet.switchChain };
    if (preparing) return { label: 'Preparing…' };
    if (flow.phase === 'signing') return { label: 'Confirm in your wallet…' };
    return { label: flow.phase === 'error' ? 'Try again' : 'Withdraw', onClick: () => void withdraw() };
  })();

  const shownMin = started ? signedMin : quote.status === 'ok' ? quote.minOutput : undefined;
  const toSonic = dstChainKey === ChainKeys.SONIC_MAINNET;

  return (
    <Dialog open onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{started ? 'Withdrawing' : `Withdraw ${vault.shareSymbol}`}</DialogTitle>
          <DialogDescription>
            You hold {formatTokenAmount(shares, SHARE_DECIMALS)} {vault.shareSymbol} from {chainName(srcChainKey)}. You
            sign on {chainName(srcChainKey)}.
          </DialogDescription>
        </DialogHeader>

        {!started && token && (
          <fieldset disabled={busy} className="flex flex-col gap-4">
            <Field
              label="Shares"
              htmlFor="withdraw-amount"
              aside={
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setAmount(formatUnits(shares, SHARE_DECIMALS))}
                >
                  Max
                </button>
              }
            >
              <Input
                id="withdraw-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                aria-invalid={tooMuch || (amount.trim() !== '' && inputShares === undefined)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="To network" htmlFor="withdraw-chain">
                <ChainSelect id="withdraw-chain" value={dstChainKey} onChange={setDstChainKey} />
              </Field>
              <Field label="Receive token" htmlFor="withdraw-token">
                <TokenSelect
                  id="withdraw-token"
                  tokens={tokens}
                  value={token}
                  onChange={t => setTokenSymbol(t.symbol)}
                />
              </Field>
            </div>
          </fieldset>
        )}

        {token && (
          <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
            {!started && (
              <SummaryRow label="You receive (≈)">
                {quote.status === 'ok' ? `${formatTokenAmount(quote.quoted, token.decimals)} ${token.symbol}` : '–'}
              </SummaryRow>
            )}
            <SummaryRow label={`Minimum you accept (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`}>
              {shownMin !== undefined ? `${formatTokenAmount(shownMin, token.decimals)} ${token.symbol}` : '–'}
            </SummaryRow>
            <SummaryRow label="Paid to" text>
              Your wallet on {chainName(dstChainKey)}
            </SummaryRow>
            {quote.status === 'error' && !started && <p className="text-xs text-destructive">{quote.message}</p>}
          </div>
        )}

        <FlowSteps steps={withdrawSteps(srcChainKey, dstChainKey, flow)} />

        {!started && (
          <Callout className="text-xs leading-relaxed">
            <strong>Real funds.</strong> A solver buys your shares at its quote, and nothing fills below the minimum
            above. The share price can be lower than when you deposited.
          </Callout>
        )}
        {prepareError && <Callout variant="destructive">{prepareError}</Callout>}
        {flow.error && <Callout variant="destructive">{flow.error}</Callout>}
        <FillOutcome
          fill={flow.fill}
          success={{
            title: 'Withdrawal filled',
            amount:
              signedMin !== undefined && token
                ? { value: Number(formatUnits(signedMin, token.decimals)), unit: `${token.symbol} or more` }
                : undefined,
            caption: toSonic
              ? 'Paid to your wallet on Sonic.'
              : `Filled on Sonic. The payout to your wallet on ${chainName(dstChainKey)} follows shortly.`,
          }}
        />

        {started && !flow.busy && flow.fill.state === 'pending' && (
          <p className="text-xs text-muted-foreground">
            You can close this. The solver still fills the withdrawal and pays your wallet on {chainName(dstChainKey)}.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {started ? (
            <Button disabled={flow.busy} onClick={onClose}>
              {flow.fill.state === 'filled' ? 'Done' : flow.busy ? 'Confirm in your wallet…' : 'Close'}
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!action.onClick || busy} onClick={action.onClick}>
                {action.label}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function withdrawSteps(srcChainKey: SourceChainKey, dstChainKey: SourceChainKey, flow: VaultFlow): FlowStep[] {
  const { phase, srcTx, delivery, fill } = flow;
  const steps: FlowStep[] = [
    {
      label: `Sign the withdrawal on ${chainName(srcChainKey)}`,
      detail: phase === 'signing' ? 'Confirm in your wallet.' : undefined,
      state: srcTx ? 'done' : phase === 'signing' ? 'active' : 'upcoming',
      txUrl: srcTx ? explorerTxUrl(srcTx.srcChainKey, srcTx.srcTxHash) : undefined,
    },
  ];
  if (srcChainKey !== ChainKeys.SONIC_MAINNET) {
    steps.push({
      label: 'SODAX delivers it to Sonic',
      state: delivery || fill.state === 'filled' ? 'done' : phase === 'delivering' ? 'active' : 'upcoming',
      txUrl: delivery?.dstTxHash ? explorerTxUrl(delivery.dstChainKey, delivery.dstTxHash) : undefined,
    });
  }
  const waiting = delivery !== undefined || phase === 'unknown';
  steps.push({
    label: `A solver fills it and pays out on ${chainName(dstChainKey)}`,
    detail: waiting && fill.state === 'pending' ? 'Usually under 2 minutes. Safe to wait here.' : undefined,
    state: fillStepState(waiting, fill.state),
    // The fill transaction is on the hub, whatever the payout network.
    txUrl:
      fill.state === 'filled' && fill.fillTxHash ? explorerTxUrl(ChainKeys.SONIC_MAINNET, fill.fillTxHash) : undefined,
  });
  return steps;
}
