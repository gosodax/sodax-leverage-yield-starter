import { useLeverageYieldDeposit, useLeverageYieldShareBalances, useSwapAllowance } from '@sodax/dapp-kit';
import type { LeverageYieldSwapPayload } from '@sodax/sdk';
import { ChainKeys, type XToken } from '@sodax/types';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_SLIPPAGE_BPS, REFETCH_MS, type SourceChainKey } from '@/config/workshop';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { formatBps, formatTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { type FlowStep, FlowSteps, fillStepState } from './FlowSteps';
import { FillOutcome, RiskNotice, SummaryRow } from './parts';
import { SHARE_DECIMALS } from './units';
import { useVaultFlow, type VaultFlow } from './useVaultFlow';
import type { VaultQuote } from './useVaultQuote';
import type { VaultInfo } from './useVaults';

export type DepositRequest = {
  vault: VaultInfo;
  chainKey: SourceChainKey;
  token: XToken;
  inputAmount: bigint;
  /** Fixed when the review opened: this is the minimum the user signs. */
  minOutput: bigint;
  srcAddress: string;
  payload: LeverageYieldSwapPayload;
};

/** Review (amounts, minimum, steps, risks), then approve if needed, sign, and follow the deposit to the fill. */
export function DepositDialog({
  request,
  liveQuote,
  onClose,
}: {
  request: DepositRequest;
  liveQuote: VaultQuote;
  onClose: (completed: boolean) => void;
}) {
  const { vault, chainKey, token, inputAmount, minOutput, payload, srcAddress } = request;
  const wallet = useEvmWallet(chainKey);
  const flow = useVaultFlow(chainKey);
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();

  const allowance = useSwapAllowance({
    params: { payload: payload.params, srcChainKey: chainKey, walletProvider: wallet.walletProvider },
    // The hook polls every 2s by default.
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  // Anything but a confirmed allowance gets an approve step: a failed check must not skip one.
  const needsApproval = allowance.data !== true && !flow.approved;
  const showApproveStep = needsApproval || flow.approved;

  // The minimum is fixed; if the live quote drops below it, no solver would fill.
  const priceMoved = liveQuote.status === 'ok' && liveQuote.quoted < minOutput;
  const accountChanged = wallet.address !== undefined && wallet.address.toLowerCase() !== srcAddress.toLowerCase();
  const started = flow.phase !== 'ready' && flow.phase !== 'error';
  const done = flow.fill.state === 'filled';

  const holdings = useLeverageYieldShareBalances({
    params: { vault: vault.vault.vault, holders: done ? [{ chainKey, address: srcAddress }] : [] },
  });
  const sharesNow = holdings[0]?.data?.shares;

  const confirm = () => {
    if (!wallet.walletProvider) return;
    void flow.run({
      payload,
      walletProvider: wallet.walletProvider,
      needsApproval,
      // Same inputs and minimum, fresh deadline: an approval can take minutes.
      rebuild: () =>
        buildDeposit({
          vault: vault.vault.vault,
          srcChainKey: chainKey,
          srcAddress,
          inputToken: token.address,
          inputAmount,
          minOutputAmount: minOutput,
        }),
    });
  };

  const blocker = accountChanged
    ? 'Your wallet switched accounts. Close this and review again.'
    : priceMoved
      ? 'The price moved below your minimum. Close this and review again for a fresh quote.'
      : undefined;

  return (
    <Dialog open onOpenChange={open => !open && !flow.busy && onClose(started)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{started ? 'Depositing' : 'Review deposit'}</DialogTitle>
          <DialogDescription>
            {formatTokenAmount(inputAmount, token.decimals)} {token.symbol} on {chainName(chainKey)} into{' '}
            {vault.shareSymbol}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
          <SummaryRow label="You pay">
            {formatTokenAmount(inputAmount, token.decimals)} {token.symbol}
          </SummaryRow>
          <SummaryRow label="You receive (≈, live)">
            {liveQuote.status === 'ok'
              ? `${formatTokenAmount(liveQuote.quoted, SHARE_DECIMALS)} ${vault.shareSymbol}`
              : '–'}
          </SummaryRow>
          <SummaryRow label={`Minimum you accept (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`}>
            {formatTokenAmount(minOutput, SHARE_DECIMALS)} {vault.shareSymbol}
          </SummaryRow>
          <SummaryRow label="Shares go to" text>
            Your SODAX hub wallet on Sonic
          </SummaryRow>
        </div>

        <FlowSteps steps={depositSteps(request, flow, showApproveStep)} />

        {!started && <RiskNotice />}
        {!started && blocker && <Callout variant="destructive">{blocker}</Callout>}
        {!started && allowance.isError && (
          <p className="text-xs text-muted-foreground">
            Couldn't check your {token.symbol} approval, so the approve step stays in. Retrying.
          </p>
        )}
        {flow.error && <Callout variant="destructive">{flow.error}</Callout>}
        <FillOutcome
          fill={flow.fill}
          success={{
            title: 'Deposit filled',
            amount:
              sharesNow === undefined
                ? undefined
                : { value: Number(formatUnits(sharesNow, SHARE_DECIMALS)), unit: vault.shareSymbol },
            caption: `Your ${vault.shareSymbol} from ${chainName(chainKey)}, held in your SODAX hub wallet on Sonic.`,
          }}
        />

        {started && !flow.busy && flow.fill.state === 'pending' && (
          <p className="text-xs text-muted-foreground">
            You can close this. The solver still fills the deposit, and your shares show under Your position.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {started ? (
            <Button disabled={flow.busy} onClick={() => onClose(true)}>
              {done ? 'Done' : flow.busy ? 'Confirm in your wallet…' : 'Close'}
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={flow.busy} onClick={() => onClose(false)}>
                Cancel
              </Button>
              {wallet.isWrongChain ? (
                <Button onClick={wallet.switchChain}>Switch to {chainName(chainKey)}</Button>
              ) : (
                <Button
                  disabled={flow.busy || allowance.isLoading || !!blocker || !wallet.walletProvider}
                  onClick={confirm}
                >
                  {confirmLabel(flow, allowance.isLoading, needsApproval, token.symbol)}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function confirmLabel(flow: VaultFlow, allowanceLoading: boolean, needsApproval: boolean, symbol: string): string {
  if (flow.phase === 'approving') return 'Approving… (your wallet may ask twice)';
  if (allowanceLoading) return 'Checking approval…';
  if (flow.phase === 'error') return 'Try again';
  return needsApproval ? `Approve ${symbol} and deposit` : 'Deposit';
}

function depositSteps(request: DepositRequest, flow: VaultFlow, showApproveStep: boolean): FlowStep[] {
  const { chainKey, token } = request;
  const { phase, approved, approveTxHash, srcTx, delivery, fill } = flow;
  const steps: FlowStep[] = [];

  if (showApproveStep) {
    steps.push({
      label: `Approve ${token.symbol} on ${chainName(chainKey)}`,
      detail: 'Lets SODAX move the amount you deposit. Skipped when your allowance already covers it.',
      state: approved ? 'done' : phase === 'approving' ? 'active' : 'upcoming',
      txUrl: approveTxHash ? explorerTxUrl(chainKey, approveTxHash) : undefined,
    });
  }
  steps.push({
    label: `Sign the deposit on ${chainName(chainKey)}`,
    detail: phase === 'signing' ? 'Confirm in your wallet.' : undefined,
    state: srcTx ? 'done' : phase === 'signing' ? 'active' : 'upcoming',
    txUrl: srcTx ? explorerTxUrl(srcTx.srcChainKey, srcTx.srcTxHash) : undefined,
  });
  if (chainKey !== ChainKeys.SONIC_MAINNET) {
    steps.push({
      label: 'SODAX delivers it to Sonic',
      state: delivery || fill.state === 'filled' ? 'done' : phase === 'delivering' ? 'active' : 'upcoming',
      txUrl: delivery?.dstTxHash ? explorerTxUrl(delivery.dstChainKey, delivery.dstTxHash) : undefined,
    });
  }
  const waiting = delivery !== undefined || phase === 'unknown';
  steps.push({
    label: 'A solver fills it: shares land in your hub wallet',
    detail: waiting && fill.state === 'pending' ? 'Usually under 2 minutes. Safe to wait here.' : undefined,
    state: fillStepState(waiting, fill.state),
    txUrl:
      fill.state === 'filled' && fill.fillTxHash ? explorerTxUrl(ChainKeys.SONIC_MAINNET, fill.fillTxHash) : undefined,
  });
  return steps;
}
