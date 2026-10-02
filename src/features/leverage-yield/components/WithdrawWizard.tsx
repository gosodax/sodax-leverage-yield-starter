import { ChainKeys, type LeverageYieldVault, type XToken } from '@sodax/types';
import { useEffect, useMemo, useState } from 'react';
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
import { useVaultData } from '../hooks/useVaultData';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { flavorOf, formatShares, SHARE_DECIMALS, shareValue, underlying } from '../lib/vaults';
import { Btn, GroupBox, Prop } from '../win/controls';
import { BottleIcon, ErrorIcon, InfoIcon, WarnIcon } from '../win/icons';
import { BannerArt } from './BannerArt';
import type { FlowNotice } from './DepositWizard';
import { FlowSteps } from './FlowSteps';
import { FieldRow, LiveDot, NetworkRadios, SlippageSelect, TokenSelect } from './FormBits';
import { WizardFrame } from './WizardFrame';

type Page = 'setup' | 'review' | 'progress';

/**
 * Withdraw Wizard: shares held under one source network → any token on any network. Signed on the network that
 * deposited (its hub wallet holds the shares). No approval: the payload authorises the hub wallet itself.
 */
export function WithdrawWizard({
  open,
  onOpenChange,
  vaults,
  vaultName,
  heldOn,
  onPick,
  prices,
  onNotice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaults: readonly LeverageYieldVault[];
  vaultName: string | undefined;
  heldOn: SourceChainKey | undefined;
  onPick: (vaultName: string, heldOn: SourceChainKey | undefined) => void;
  prices: UsdPrices;
  onNotice: (notice: FlowNotice) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const wallet0 = useEvmWallet();
  const data = useVaultData(vault, wallet0.address);
  const withShares = data.holdings.filter(h => h.shares > 0n);
  // Locked at confirm: a full withdrawal empties this network's holding mid-flight, and the derived default must not
  // then jump to another network (status tracking and the signer are keyed on it).
  const [lockedChain, setLockedChain] = useState<SourceChainKey>();
  const srcChainKey: SourceChainKey = lockedChain ?? heldOn ?? withShares[0]?.chainKey ?? ChainKeys.BASE_MAINNET;
  const held = data.holdings.find(h => h.chainKey === srcChainKey)?.shares;

  const [page, setPage] = useState<Page>('setup');
  const [dstChainKey, setDstChainKey] = useState<SourceChainKey>(srcChainKey);
  const tokens = useMemo(() => getDepositTokens(dstChainKey), [dstChainKey]);
  const [token, setToken] = useState<XToken | undefined>(() => getTokenByKey(srcChainKey, DEFAULT_TOKEN_KEY));
  const [sharesText, setSharesText] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const wallet = useEvmWallet(srcChainKey);
  const { address } = wallet;
  const flow = useVaultFlow(srcChainKey);
  const asset = vault ? underlying(vault) : undefined;
  const flavor = vault ? flavorOf(vault) : undefined;

  // A new holding picked from outside: pay out on the same network by default.
  useEffect(() => {
    setDstChainKey(srcChainKey);
  }, [srcChainKey]);
  useEffect(() => {
    if (token && tokens.some(t => t.address === token.address)) return;
    setToken(
      tokens.find(t => t.symbol === token?.symbol) ?? getTokenByKey(dstChainKey, DEFAULT_TOKEN_KEY) ?? tokens[0],
    );
  }, [tokens, token, dstChainKey]);

  const shares = parseTokenAmount(sharesText, SHARE_DECIMALS);
  const quote = useVaultQuote({
    srcToken: vault?.vault,
    srcChainKey: ChainKeys.SONIC_MAINNET,
    dstToken: token?.address,
    dstChainKey,
    amount: shares,
    slippageBps,
  });
  const outUsd = toUsd(quote.amountOut, token?.decimals ?? 18, priceFor(prices, token?.vault));
  const worth = shareValue(shares, data.sharePrice.data);

  const tooMuch = shares !== undefined && held !== undefined && shares > held;
  const blocker = !address
    ? 'Connect a wallet to continue.'
    : !data.holdingsLoaded
      ? 'Reading your shares…'
      : !held
        ? `You hold no ${vault?.name} shares from ${chainName(srcChainKey)}.`
        : !shares
          ? 'Enter how many shares to withdraw.'
          : tooMuch
            ? `You only hold ${formatTokenAmount(held, SHARE_DECIMALS, 6)} shares from ${chainName(srcChainKey)}.`
            : quote.problem
              ? quote.problem.message
              : quote.minOut === undefined
                ? 'Waiting for a quote…'
                : undefined;

  const step = flow.state.step;
  useEffect(() => {
    if (step === 'idle' || step === 'preparing') return onNotice(undefined);
    onNotice({
      kind: 'withdraw',
      label:
        step === 'done'
          ? `Withdrawal from ${vault?.name} complete`
          : step === 'error'
            ? 'Withdrawal failed'
            : `Withdrawing from ${vault?.name}…`,
      done: step === 'done',
      failed: step === 'error',
    });
  }, [step, vault?.name, onNotice]);
  useEffect(() => {
    if (step === 'idle' && page === 'progress') setPage('review');
  }, [step, page]);
  // Back on the form with nothing in flight: the network is editable again.
  useEffect(() => {
    if (step === 'idle' && page !== 'progress') setLockedChain(undefined);
  }, [step, page]);

  const setFraction = (num: bigint, den: bigint) => {
    if (!held) return;
    const value = (held * num) / den;
    setSharesText(formatTokenAmount(value, SHARE_DECIMALS, SHARE_DECIMALS).replace(/,/g, ''));
  };

  const startOver = () => {
    setLockedChain(undefined);
    flow.reset();
    setSharesText('');
    setPage('setup');
  };

  const confirm = () => {
    if (!vault || !token || !address || !wallet.walletProvider || !shares || quote.minOut === undefined) return;
    setLockedChain(srcChainKey);
    setPage('progress');
    void flow.withdraw({
      vault,
      srcChainKey,
      srcAddress: address,
      dstChainKey,
      outputToken: token,
      shares,
      minAmountOut: quote.minOut,
      walletProvider: wallet.walletProvider,
    });
  };

  if (!vault || !asset || !flavor) return null;
  const wrongChainButton = address && wallet.isWrongChain && (
    <Btn isDefault onClick={wallet.switchChain}>
      Switch to {chainName(srcChainKey)}
    </Btn>
  );
  const steps = (planned?: boolean) => (
    <FlowSteps
      planned={planned}
      kind="withdraw"
      state={flow.state}
      phase={planned ? 'unknown' : flow.phase}
      fillTxHash={flow.fillTxHash}
      srcChainKey={srcChainKey}
      fillChainKey={dstChainKey}
      tokenSymbol={token?.symbol ?? ''}
      approval="no"
    />
  );

  if (page === 'progress') {
    const done = step === 'done';
    return (
      <WizardFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Withdraw Wizard"
        heading={
          done
            ? 'Completing the Withdraw Wizard'
            : step === 'error'
              ? 'The withdrawal did not go through'
              : 'Withdrawing…'
        }
        banner={done}
        bannerArt={<BannerArt color={flavor.color} colorDark={flavor.colorDark} label={asset.symbol} />}
        icon={<BottleIcon size={32} color={flavor.color} />}
        subheading={
          step === 'submitted'
            ? 'Your order is on its way. It usually fills in under two minutes.'
            : step === 'error' || done
              ? undefined
              : 'Confirm the request in your wallet.'
        }
        footer={
          done ? (
            <Btn
              isDefault
              onClick={() => {
                startOver();
                onOpenChange(false);
              }}
            >
              Finish
            </Btn>
          ) : step === 'error' ? (
            <>
              <Btn
                onClick={() => {
                  flow.reset();
                  setPage('review');
                }}
              >
                &lt; Back
              </Btn>
              <Btn
                isDefault
                onClick={() => {
                  flow.reset();
                  confirm();
                }}
              >
                Try again
              </Btn>
              <Btn
                onClick={() => {
                  startOver();
                  onOpenChange(false);
                }}
              >
                Close
              </Btn>
            </>
          ) : (
            <Btn onClick={() => onOpenChange(false)} disabled={step !== 'submitted'}>
              {step === 'submitted' ? 'Hide (keeps tracking)' : 'Cancel'}
            </Btn>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {done && (
            <p>
              {token?.symbol} is on its way to your wallet on {chainName(dstChainKey)}. Remaining shares from{' '}
              {chainName(srcChainKey)}: <b>{formatShares(held)}</b>.
            </p>
          )}
          {steps()}
          {step === 'error' && (
            <div className="flex items-start gap-2">
              <ErrorIcon />
              <p className="font-bold">{flow.state.error}</p>
            </div>
          )}
          {step === 'submitted' && (
            <div className="flex items-start gap-2 bg-[var(--win-tooltip)] p-2 bevel-thin-in">
              <InfoIcon size={20} />
              <p>
                {flow.timedOut
                  ? 'This is taking longer than usual. It may still fill; the links above show it is on-chain. Your shares are safe until it does.'
                  : 'You can hide this window. The taskbar keeps tracking and a balloon pops up when it fills.'}
              </p>
            </div>
          )}
        </div>
      </WizardFrame>
    );
  }

  if (page === 'review') {
    return (
      <WizardFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Withdraw Wizard"
        heading="Review your withdrawal"
        subheading="Check the amounts. They refresh with the live quote until you sign."
        icon={<BottleIcon size={32} color={flavor.color} />}
        footer={
          <>
            <Btn onClick={() => setPage('setup')}>&lt; Back</Btn>
            {wrongChainButton || (
              <Btn isDefault onClick={confirm} disabled={!!blocker}>
                Withdraw
              </Btn>
            )}
            <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <GroupBox label="Summary">
            <dl>
              <Prop label="You redeem">{formatShares(shares)}</Prop>
              <Prop label="">
                <span className="font-normal text-[var(--win-dark)]">
                  ≈ {formatTokenAmount(worth, asset.decimals, 6)} {asset.symbol}
                </span>
              </Prop>
              <Prop label="Held from">{chainName(srcChainKey)} (you sign here)</Prop>
              <Prop label="You receive ≈">
                {formatTokenAmount(quote.amountOut, token?.decimals ?? 18, 6)} {token?.symbol}{' '}
                <LiveDot busy={quote.refreshing} />
              </Prop>
              <Prop label="">
                <span className="font-normal text-[var(--win-dark)]">{formatUsd(outUsd)}</span>
              </Prop>
              <Prop label={`Minimum accepted (${slippageBps / 100}% slippage)`}>
                {formatTokenAmount(quote.minOut, token?.decimals ?? 18, 6)} {token?.symbol}
              </Prop>
              <Prop label="Paid out on">{chainName(dstChainKey)}</Prop>
            </dl>
          </GroupBox>
          <GroupBox label="You will be asked to">{steps(true)}</GroupBox>
          {blocker && (
            <p className="flex items-center gap-2 text-[var(--destructive)]">
              <WarnIcon size={16} /> {blocker}
            </p>
          )}
        </div>
      </WizardFrame>
    );
  }

  return (
    <WizardFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Withdraw Wizard"
      heading="Choose what to withdraw"
      subheading="Pick the shares, how many, and where the money should go."
      icon={<BottleIcon size={32} color={flavor.color} />}
      footer={
        <>
          <Btn disabled>&lt; Back</Btn>
          {!address ? (
            <Btn isDefault onClick={wallet.connect}>
              Connect wallet…
            </Btn>
          ) : (
            wrongChainButton || (
              <Btn isDefault onClick={() => setPage('review')} disabled={!!blocker}>
                Next &gt;
              </Btn>
            )
          )}
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <FieldRow label="Vault:" htmlFor="wd-vault">
          <select
            id="wd-vault"
            className="w2k-select w-full"
            value={vault.name}
            onChange={e => onPick(e.target.value, undefined)}
          >
            {vaults.map(v => (
              <option key={v.vault} value={v.name}>
                {flavorOf(v).soda} ({v.name})
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Shares held from:">
          <NetworkRadios
            name="wd-src"
            value={srcChainKey}
            onChange={c => onPick(vault.name, c)}
            current={wallet.currentChainKey}
          />
          <p className="mt-1 text-[var(--win-dark)]">
            {data.holdingsLoaded
              ? data.holdings
                  .map(h => `${chainName(h.chainKey)}: ${formatTokenAmount(h.shares, SHARE_DECIMALS, 4)}`)
                  .join(' · ')
              : 'Reading your shares…'}
          </p>
        </FieldRow>
        <FieldRow label="Shares:" htmlFor="wd-shares">
          <div className="flex flex-wrap gap-1.5">
            <input
              id="wd-shares"
              className="w2k-input min-w-0 flex-1 basis-32"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={sharesText}
              onChange={e => setSharesText(e.target.value)}
            />
            {(
              [
                ['25%', 1n, 4n],
                ['50%', 1n, 2n],
                ['Max', 1n, 1n],
              ] as const
            ).map(([label, num, den]) => (
              <Btn key={label} className="!min-w-[44px] !px-2" disabled={!held} onClick={() => setFraction(num, den)}>
                {label}
              </Btn>
            ))}
          </div>
          <p className="mt-1 text-[var(--win-dark)]">
            Worth ≈ {formatTokenAmount(worth, asset.decimals, 6)} {asset.symbol} · held{' '}
            {formatTokenAmount(held, SHARE_DECIMALS, 6)}
          </p>
        </FieldRow>
        <FieldRow label="Pay out on:">
          <NetworkRadios name="wd-dst" value={dstChainKey} onChange={setDstChainKey} />
        </FieldRow>
        <FieldRow label="As token:" htmlFor="wd-token">
          <TokenSelect id="wd-token" tokens={tokens} value={token} onChange={setToken} />
        </FieldRow>

        <GroupBox
          label={
            <span className="inline-flex items-center gap-1.5">
              Live quote <LiveDot busy={quote.refreshing || quote.loading} />
            </span>
          }
        >
          {quote.problem ? (
            <div className="flex items-start gap-2">
              <WarnIcon size={20} />
              <div className="flex-1">
                <p>{quote.problem.message}</p>
                <Btn className="mt-1.5" onClick={quote.refetch}>
                  Retry
                </Btn>
              </div>
            </div>
          ) : (
            <dl>
              <Prop label="You receive ≈">
                {quote.loading && !quote.amountOut
                  ? 'Quoting…'
                  : `${formatTokenAmount(quote.amountOut, token?.decimals ?? 18, 6)} ${token?.symbol ?? ''}`}{' '}
                <span className="font-normal text-[var(--win-dark)]">{formatUsd(outUsd)}</span>
              </Prop>
              <Prop label="Minimum accepted">
                {formatTokenAmount(quote.minOut, token?.decimals ?? 18, 6)} {token?.symbol}
              </Prop>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[var(--win-dark)]">Slippage tolerance</span>
                <SlippageSelect value={slippageBps} onChange={setSlippageBps} />
              </div>
            </dl>
          )}
        </GroupBox>
        {tooMuch && (
          <p className="flex items-center gap-2 text-[var(--destructive)]">
            <WarnIcon size={16} /> You only hold {formatTokenAmount(held, SHARE_DECIMALS, 6)} shares from{' '}
            {chainName(srcChainKey)}.
          </p>
        )}
        <p className="text-[10px] leading-snug text-[var(--win-dark)]">
          You sign on {chainName(srcChainKey)} because that network's hub wallet holds these shares. No approval needed.
        </p>
      </div>
    </WizardFrame>
  );
}
