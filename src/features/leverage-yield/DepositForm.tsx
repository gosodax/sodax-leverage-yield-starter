import { useBalances, useLeverageYieldDeposit, useLeverageYieldPreviewRedeem } from '@sodax/dapp-kit';
import { ChainKeys, type XToken } from '@sodax/types';
import { useMemo, useState } from 'react';
import { formatUnits, zeroAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, ONE_SHARE, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { DepositDialog, type DepositRequest } from './DepositDialog';
import { FlashValue } from './motion';
import { Field, SummaryRow } from './parts';
import { ChainSelect, TokenSelect, VaultSelect } from './pickers';
import { formatUsd, SHARE_DECIMALS, shareValue, toUsd } from './units';
import { flowErrorMessage } from './useVaultFlow';
import { useVaultQuote } from './useVaultQuote';
import { useAssetUsdPrice, type VaultInfo } from './useVaults';

function pickToken(tokens: XToken[], chainKey: SourceChainKey, symbol: string): XToken | undefined {
  return tokens.find(t => t.symbol === symbol) ?? getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ?? tokens[0];
}

/** Pick a vault, a source network and token, an amount; see a live quote and the minimum before reviewing. */
export function DepositForm({
  vaults,
  vaultName,
  onVaultChange,
}: {
  vaults: VaultInfo[];
  vaultName: string;
  onVaultChange: (name: string) => void;
}) {
  const vault = vaults.find(v => v.vault.name === vaultName) ?? vaults[0];
  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [tokenSymbol, setTokenSymbol] = useState<string>(DEFAULT_TOKEN_KEY);
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<DepositRequest>();
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string>();

  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const token = pickToken(tokens, chainKey, tokenSymbol);
  const wallet = useEvmWallet(chainKey);
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();

  const { data: balances } = useBalances({
    params: { chainKey, tokens, address: wallet.address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const balance = token ? balances?.[token.address] : undefined;
  const isNative = token?.address === zeroAddress;
  const spendable =
    balance === undefined ? undefined : isNative ? max0(balance - NATIVE_GAS_RESERVE[chainKey]) : balance;

  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;
  const insufficient = spendable !== undefined && inputAmount !== undefined && inputAmount > spendable;

  const payload = useMemo(
    () =>
      token && vault && inputAmount && inputAmount > 0n
        ? {
            token_src: token.address,
            token_src_blockchain_id: chainKey,
            token_dst: vault.vault.vault,
            token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
            amount: inputAmount,
            quote_type: 'exact_input' as const,
          }
        : undefined,
    [token, vault, inputAmount, chainKey],
  );
  const { quote, isFetching, refresh } = useVaultQuote(payload, DEFAULT_SLIPPAGE_BPS);

  const { data: pricePerShare } = useLeverageYieldPreviewRedeem({
    params: { vault: vault?.vault.vault, shares: ONE_SHARE },
  });
  const assetPrice = useAssetUsdPrice(vault?.vault.asset ?? '');
  const quotedUsd =
    quote.status === 'ok' && pricePerShare !== undefined && vault
      ? toUsd(shareValue(quote.quoted, pricePerShare), vault.assetDecimals, assetPrice)
      : undefined;

  if (!vault || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deposit</CardTitle>
          <CardDescription>No vaults or deposit tokens are configured.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openReview = async () => {
    if (quote.status !== 'ok' || !wallet.address || !inputAmount) return;
    setPreparing(true);
    setPrepareError(undefined);
    const fresh = await refresh();
    if (fresh.status !== 'ok') {
      setPreparing(false);
      setPrepareError(fresh.status === 'error' ? fresh.message : 'The quote is not ready yet. Try again.');
      return;
    }
    const built = await buildDeposit({
      vault: vault.vault.vault,
      srcChainKey: chainKey,
      srcAddress: wallet.address,
      inputToken: token.address,
      inputAmount,
      minOutputAmount: fresh.minOutput,
    });
    setPreparing(false);
    if (!built.ok) {
      console.error('[leverage-yield] building the deposit failed', built.error);
      setPrepareError(flowErrorMessage(built.error));
      return;
    }
    setReview({
      vault,
      chainKey,
      token,
      inputAmount,
      minOutput: fresh.minOutput,
      srcAddress: wallet.address,
      payload: built.value,
    });
  };

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (amount.trim() === '') return { label: 'Enter an amount' };
    if (inputAmount === undefined) return { label: 'Invalid amount' };
    if (inputAmount === 0n) return { label: 'Enter an amount' };
    if (insufficient) return { label: `Not enough ${token.symbol}` };
    if (quote.status === 'loading') return { label: 'Getting quote…' };
    if (quote.status !== 'ok') return { label: 'No quote yet' };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (preparing) return { label: 'Preparing…' };
    return { label: 'Review deposit', onClick: () => void openReview() };
  })();

  return (
    <Card id="deposit-form" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Deposit</CardTitle>
        <CardDescription>From any supported network and token. You receive vault shares.</CardDescription>
      </CardHeader>
      {/* Locked while the payload builds, so what gets reviewed is what was entered. */}
      <fieldset disabled={preparing} className="contents">
        <CardContent className="flex flex-col gap-4">
          <Field label="Vault" htmlFor="deposit-vault">
            <VaultSelect id="deposit-vault" vaults={vaults} value={vault.vault.name} onChange={onVaultChange} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From network" htmlFor="deposit-chain">
              <ChainSelect id="deposit-chain" value={chainKey} onChange={setChainKey} />
            </Field>
            <Field label="Token" htmlFor="deposit-token">
              <TokenSelect id="deposit-token" tokens={tokens} value={token} onChange={t => setTokenSymbol(t.symbol)} />
            </Field>
          </div>
          <Field
            label="Amount"
            htmlFor="deposit-amount"
            aside={
              spendable !== undefined && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setAmount(formatUnits(spendable, token.decimals))}
                >
                  Balance {formatTokenAmount(balance, token.decimals)} {token.symbol} · Max
                </button>
              )
            }
          >
            <Input
              id="deposit-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              aria-invalid={insufficient || (amount.trim() !== '' && inputAmount === undefined)}
            />
            {isNative && (
              <p className="text-xs text-subtle-foreground">
                Max keeps {formatTokenAmount(NATIVE_GAS_RESERVE[chainKey], 18)} {token.symbol} for gas.
              </p>
            )}
          </Field>

          <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-4">
            <SummaryRow label="You receive (≈)">
              {quote.status === 'ok' ? (
                <>
                  <FlashValue value={quote.quoted}>
                    {formatTokenAmount(quote.quoted, SHARE_DECIMALS)} {vault.shareSymbol}
                  </FlashValue>
                  {quotedUsd !== undefined && (
                    <span className="ml-1 font-normal text-muted-foreground">({formatUsd(quotedUsd)})</span>
                  )}
                </>
              ) : (
                '–'
              )}
            </SummaryRow>
            <SummaryRow label={`Minimum (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`}>
              {quote.status === 'ok'
                ? `${formatTokenAmount(quote.minOutput, SHARE_DECIMALS)} ${vault.shareSymbol}`
                : '–'}
            </SummaryRow>
            {quote.status === 'error' && <p className="text-xs text-destructive">{quote.message}</p>}
            {quote.status === 'ok' && (
              <p className="text-xs text-subtle-foreground">
                Live quote from the solver marketplace
                {isFetching ? ', refreshing…' : `, refreshes every ${REFETCH_MS / 1000}s`}.
              </p>
            )}
          </div>

          {prepareError && <p className="text-sm text-destructive">{prepareError}</p>}
          <Button size="lg" disabled={!action.onClick} onClick={action.onClick}>
            {action.label}
          </Button>
        </CardContent>
      </fieldset>

      {review && (
        <DepositDialog
          request={review}
          liveQuote={
            review.inputAmount === inputAmount &&
            review.chainKey === chainKey &&
            review.token.address === token.address &&
            review.vault.vault.name === vault.vault.name
              ? quote
              : { status: 'idle' }
          }
          onClose={completed => {
            setReview(undefined);
            if (completed) setAmount('');
          }}
        />
      )}
    </Card>
  );
}

function max0(value: bigint): bigint {
  return value > 0n ? value : 0n;
}
