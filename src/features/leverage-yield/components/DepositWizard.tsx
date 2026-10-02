import { useBalances } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type XToken } from '@sodax/types';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatRayPercent, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useVaultData } from '../hooks/useVaultData';
import { useVaultFlow } from '../hooks/useVaultFlow';
import { useVaultQuote } from '../hooks/useVaultQuote';
import { formatExposure } from '../lib/display';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { exposureWad, flavorOf, formatShares, SHARE_DECIMALS, shareValue, underlying } from '../lib/vaults';
import { Btn, GroupBox, Prop } from '../win/controls';
import { BottleIcon, ErrorIcon, InfoIcon, WarnIcon } from '../win/icons';
import { BannerArt } from './BannerArt';
import { FlowSteps } from './FlowSteps';
import { FieldRow, FlowStepsNote, isNative, LiveDot, NetworkRadios, SlippageSelect, TokenSelect } from './FormBits';
import { WizardFrame } from './WizardFrame';

type Page = 'setup' | 'review' | 'progress';

export type FlowNotice = { kind: 'deposit' | 'withdraw'; label: string; done: boolean; failed: boolean } | undefined;

/**
 * Deposit Wizard: pick vault, network, token and amount with a live quote → review what you receive, the minimum
 * and the risks → sign and track. It stays mounted while closed so a running deposit keeps being tracked.
 */
export function DepositWizard({
  open,
  onOpenChange,
  vaults,
  vaultName,
  onVaultChange,
  prices,
  onNotice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaults: readonly LeverageYieldVault[];
  vaultName: string | undefined;
  onVaultChange: (name: string) => void;
  prices: UsdPrices;
  onNotice: (notice: FlowNotice) => void;
}) {
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const [page, setPage] = useState<Page>('setup');
  const [chainKey, setChainKey] = useState<SourceChainKey>(ChainKeys.BASE_MAINNET);
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const [token, setToken] = useState<XToken | undefined>(() =>
    getTokenByKey(ChainKeys.BASE_MAINNET, DEFAULT_TOKEN_KEY),
  );
  const [amountText, setAmountText] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [accepted, setAccepted] = useState(false);

  const wallet = useEvmWallet(chainKey);
  const { address } = wallet;
  const flow = useVaultFlow(chainKey);
  const data = useVaultData(vault, address);
  const asset = vault ? underlying(vault) : undefined;
  const flavor = vault ? flavorOf(vault) : undefined;

  // Keep the token valid for the network; prefer the same symbol, else USDC.
  useEffect(() => {
    if (token && tokens.some(t => t.address === token.address)) return;
    setToken(tokens.find(t => t.symbol === token?.symbol) ?? getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ?? tokens[0]);
  }, [tokens, token, chainKey]);

  const amount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const balanceQuery = useBalances({
    params: { chainKey, tokens: token ? [token] : [], address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = token ? balanceQuery.data?.[token.address] : undefined;
  const nativeToken = useMemo(() => tokens.find(isNative), [tokens]);
  const gasQuery = useBalances({
    params: { chainKey, tokens: nativeToken ? [nativeToken] : [], address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const gasBalance = nativeToken ? gasQuery.data?.[nativeToken.address] : undefined;
  const reserve = isNative(token) ? NATIVE_GAS_RESERVE[chainKey] : 0n;
  const maxAmount = balance !== undefined ? (balance > reserve ? balance - reserve : 0n) : undefined;

  const quote = useVaultQuote({
    srcToken: token?.address,
    srcChainKey: chainKey,
    dstToken: vault?.vault,
    dstChainKey: ChainKeys.SONIC_MAINNET,
    amount,
    slippageBps,
  });

  const quotedValue = shareValue(quote.amountOut, data.sharePrice.data);
  const inputUsd = toUsd(amount, token?.decimals ?? 18, priceFor(prices, token?.vault));
  const outUsd = asset ? toUsd(quotedValue, asset.decimals, priceFor(prices, vault?.asset)) : undefined;

  const tooMuch = amount !== undefined && balance !== undefined && amount > balance;
  const eatsGas =
    !tooMuch && isNative(token) && amount !== undefined && balance !== undefined && amount > balance - reserve;
  const noGas = gasBalance !== undefined && gasBalance === 0n;

  const blocker: string | undefined = !address
    ? 'Connect a wallet to continue.'
    : !amount
      ? 'Enter an amount.'
      : tooMuch
        ? `Not enough ${token?.symbol}: you have ${formatTokenAmount(balance, token?.decimals ?? 18)}.`
        : quote.problem
          ? quote.problem.message
          : quote.minOut === undefined
            ? 'Waiting for a quote…'
            : undefined;

  // Notices for the taskbar tray + balloon.
  const step = flow.state.step;
  useEffect(() => {
    if (step === 'idle' || step === 'preparing') return onNotice(undefined);
    onNotice({
      kind: 'deposit',
      label:
        step === 'done'
          ? `Deposit into ${vault?.name} complete`
          : step === 'error'
            ? 'Deposit failed'
            : `Depositing into ${vault?.name}…`,
      done: step === 'done',
      failed: step === 'error',
    });
  }, [step, vault?.name, onNotice]);

  // Cancelled in the wallet → back to the review page quietly.
  useEffect(() => {
    if (step === 'idle' && page === 'progress') setPage('review');
  }, [step, page]);

  const startOver = () => {
    flow.reset();
    setAmountText('');
    setAccepted(false);
    setPage('setup');
  };

  const confirm = () => {
    if (!vault || !token || !address || !wallet.walletProvider || !amount || quote.minOut === undefined) return;
    setPage('progress');
    void flow.deposit({
      vault,
      srcChainKey: chainKey,
      srcAddress: address,
      token,
      inputAmount: amount,
      minShares: quote.minOut,
      walletProvider: wallet.walletProvider,
    });
  };

  if (!vault || !asset || !flavor) return null;
  const apr = data.apr.data;
  const running = step === 'preparing' || step === 'approving' || step === 'signing' || step === 'submitted';
  const approval = isNative(token) ? 'no' : 'maybe';
  const wrongChainButton = address && wallet.isWrongChain && (
    <Btn isDefault onClick={wallet.switchChain}>
      Switch to {chainName(chainKey)}
    </Btn>
  );

  // ---------- progress / finish ----------
  if (page === 'progress') {
    const done = step === 'done';
    return (
      <WizardFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Deposit Wizard"
        heading={
          done ? 'Completing the Deposit Wizard' : step === 'error' ? 'The deposit did not go through' : 'Depositing…'
        }
        banner={done}
        bannerArt={<BannerArt color={flavor.color} colorDark={flavor.colorDark} label={asset.symbol} />}
        icon={<BottleIcon size={32} color={flavor.color} />}
        subheading={
          done
            ? undefined
            : step === 'error'
              ? undefined
              : step === 'submitted'
                ? 'Your order is on its way. It usually fills in under two minutes.'
                : 'Confirm each request in your wallet.'
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
            <Btn
              onClick={() => onOpenChange(false)}
              disabled={step !== 'submitted'}
              title={step !== 'submitted' ? 'Finish signing in your wallet first' : undefined}
            >
              {step === 'submitted' ? 'Hide (keeps tracking)' : 'Cancel'}
            </Btn>
          )
        }
      >
        {done ? (
          <div className="flex flex-col gap-3">
            <p>You deposited into the {flavor.soda} vault. Your new shares are in your SODAX hub wallet on Sonic.</p>
            <GroupBox label="Your shares in this vault">
              <dl>
                <Prop label="Total">{formatShares(data.totalShares)}</Prop>
                <Prop label="Worth">
                  {formatTokenAmount(shareValue(data.totalShares, data.sharePrice.data), asset.decimals, 6)}{' '}
                  {asset.symbol}
                </Prop>
              </dl>
            </GroupBox>
            <FlowSteps
              kind="deposit"
              state={flow.state}
              phase={flow.phase}
              fillTxHash={flow.fillTxHash}
              srcChainKey={chainKey}
              fillChainKey={ChainKeys.SONIC_MAINNET}
              tokenSymbol={token?.symbol ?? ''}
              approval={approval}
            />
            <p className="text-[var(--win-dark)]">To close this wizard, click Finish.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <FlowSteps
              kind="deposit"
              state={flow.state}
              phase={flow.phase}
              fillTxHash={flow.fillTxHash}
              srcChainKey={chainKey}
              fillChainKey={ChainKeys.SONIC_MAINNET}
              tokenSymbol={token?.symbol ?? ''}
              approval={approval}
            />
            {step === 'error' && (
              <div className="flex items-start gap-2">
                <ErrorIcon />
                <div>
                  <p className="font-bold">{flow.state.error}</p>
                  {flow.state.failedAt === 'submitted' && (
                    <p className="mt-1 text-[var(--win-dark)]">
                      If funds were left in your hub wallet, the hosted SODAX solution app can show and recover them.
                    </p>
                  )}
                </div>
              </div>
            )}
            {step === 'submitted' && (
              <div className="flex items-start gap-2 bg-[var(--win-tooltip)] p-2 bevel-thin-in">
                <InfoIcon size={20} />
                <p>
                  {flow.timedOut
                    ? 'This is taking longer than usual. It may still fill; the links above show it is on-chain. Your funds are not lost.'
                    : 'You can hide this window. The hourglass in the taskbar keeps tracking and a balloon pops up when it fills.'}
                </p>
              </div>
            )}
          </div>
        )}
      </WizardFrame>
    );
  }

  // ---------- review ----------
  if (page === 'review') {
    return (
      <WizardFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Deposit Wizard"
        heading="Review your deposit"
        subheading="Check the amounts. They refresh with the live quote until you sign."
        icon={<BottleIcon size={32} color={flavor.color} />}
        footer={
          <>
            <Btn onClick={() => setPage('setup')}>&lt; Back</Btn>
            {wrongChainButton || (
              <Btn isDefault onClick={confirm} disabled={!!blocker || !accepted || running}>
                Deposit
              </Btn>
            )}
            <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <GroupBox label="Summary">
            <dl>
              <Prop label="You pay">
                {amountText} {token?.symbol}{' '}
                <span className="font-normal text-[var(--win-dark)]">{formatUsd(inputUsd)}</span>
              </Prop>
              <Prop label="From">{chainName(chainKey)}</Prop>
              <Prop label="Into vault">
                {flavor.soda} ({vault.name})
              </Prop>
              <Prop label="You receive ≈">
                {formatShares(quote.amountOut)} <LiveDot busy={quote.refreshing} />
              </Prop>
              <Prop label="">
                <span className="font-normal text-[var(--win-dark)]">
                  ≈ {formatTokenAmount(quotedValue, asset.decimals, 6)} {asset.symbol} {formatUsd(outUsd)}
                </span>
              </Prop>
              <Prop label={`Minimum accepted (${slippageBps / 100}% slippage)`}>
                {formatTokenAmount(quote.minOut, SHARE_DECIMALS, 6)} shares
              </Prop>
              <Prop label="Net APR (variable)">{formatRayPercent(apr?.effectiveNetAprRay)}</Prop>
              <Prop label="Exposure">{formatExposure(apr ? exposureWad(apr.leverageMultiplierWad) : undefined)}</Prop>
            </dl>
          </GroupBox>
          <GroupBox label="You will be asked to">
            <FlowSteps
              planned
              kind="deposit"
              state={flow.state}
              phase="unknown"
              fillTxHash={undefined}
              srcChainKey={chainKey}
              fillChainKey={ChainKeys.SONIC_MAINNET}
              tokenSymbol={token?.symbol ?? ''}
              approval={approval}
            />
          </GroupBox>
          {blocker && (
            <p className="flex items-center gap-2 text-[var(--destructive)]">
              <WarnIcon size={16} /> {blocker}
            </p>
          )}
          <label className="flex items-start gap-2 bg-[var(--win-tooltip)] p-2 bevel-thin-in">
            <input
              type="checkbox"
              className="w2k-check mt-0.5"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
            />
            <span>
              I understand this is a leveraged vault with real funds: the APR is variable and can go negative, the share
              price can fall, and I exit only by withdrawing.
            </span>
          </label>
        </div>
      </WizardFrame>
    );
  }

  // ---------- setup ----------
  return (
    <WizardFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Deposit Wizard"
      heading="Choose what to deposit"
      subheading="Pick a vault, the network and token you pay with, and an amount."
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
        <FieldRow label="Vault:" htmlFor="dep-vault">
          <select
            id="dep-vault"
            className="w2k-select w-full"
            value={vault.name}
            onChange={e => onVaultChange(e.target.value)}
          >
            {vaults.map(v => (
              <option key={v.vault} value={v.name}>
                {flavorOf(v).soda} ({v.name})
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Pay from:">
          <NetworkRadios name="dep-chain" value={chainKey} onChange={setChainKey} current={wallet.currentChainKey} />
        </FieldRow>
        <FieldRow label="Token:" htmlFor="dep-token">
          <TokenSelect id="dep-token" tokens={tokens} value={token} onChange={setToken} />
        </FieldRow>
        <FieldRow label="Amount:" htmlFor="dep-amount">
          <div className="flex gap-1.5">
            <input
              id="dep-amount"
              className="w2k-input min-w-0 flex-1"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountText}
              onChange={e => setAmountText(e.target.value)}
            />
            <Btn
              className="!min-w-[48px]"
              disabled={!maxAmount || !token}
              onClick={() =>
                token &&
                maxAmount &&
                setAmountText(formatTokenAmount(maxAmount, token.decimals, token.decimals).replace(/,/g, ''))
              }
            >
              Max
            </Btn>
          </div>
          <p className="mt-1 flex justify-between gap-2 text-[var(--win-dark)]">
            <span>
              Available: {address ? `${formatTokenAmount(balance, token?.decimals ?? 18)} ${token?.symbol ?? ''}` : '–'}
            </span>
            <span>{formatUsd(inputUsd)}</span>
          </p>
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
                {quote.loading && !quote.amountOut ? 'Quoting…' : formatShares(quote.amountOut)}
              </Prop>
              <Prop label="Worth ≈">
                {formatTokenAmount(quotedValue, asset.decimals, 6)} {asset.symbol}{' '}
                <span className="font-normal text-[var(--win-dark)]">{formatUsd(outUsd)}</span>
              </Prop>
              <Prop label="Minimum accepted">{formatTokenAmount(quote.minOut, SHARE_DECIMALS, 6)} shares</Prop>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[var(--win-dark)]">Slippage tolerance</span>
                <SlippageSelect value={slippageBps} onChange={setSlippageBps} />
              </div>
            </dl>
          )}
        </GroupBox>

        {tooMuch && (
          <Warning text={`You only have ${formatTokenAmount(balance, token?.decimals ?? 18)} ${token?.symbol}.`} />
        )}
        {eatsGas && <Warning text={`Leave some ${token?.symbol} for gas: Max keeps a small reserve.`} />}
        {address && noGas && !isNative(token) && (
          <Warning
            text={`You have no ${nativeToken?.symbol ?? 'native token'} on ${chainName(chainKey)} to pay gas.`}
          />
        )}
        <FlowStepsNote />
      </div>
    </WizardFrame>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-[var(--destructive)]">
      <WarnIcon size={16} />
      {text}
    </p>
  );
}
