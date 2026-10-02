import {
  type Address,
  isUserRejectedError,
  type LeverageYieldVault,
  useBalances,
  useLeverageYieldDeposit,
  useLeverageYieldDetailedStatus,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useDepositQuote, useWithdrawQuote } from '../hooks/useVaultQuotes';

export type VaultTab = 'deposit' | 'withdraw';

export function VaultDialog({
  vault,
  open,
  initialTab,
  heldShares = 0n,
  heldChain = DEFAULT_SOURCE_CHAIN,
  onOpenChange,
}: {
  vault: LeverageYieldVault;
  open: boolean;
  initialTab: VaultTab;
  heldShares?: bigint;
  heldChain?: SourceChainKey;
  onOpenChange(open: boolean): void;
}) {
  const [tab, setTab] = useState<VaultTab>(initialTab);
  const [chain, setChain] = useState<SourceChainKey>(heldChain);
  const [tokenKey, setTokenKey] = useState(DEFAULT_TOKEN_KEY);
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string>();
  const [submitted, setSubmitted] = useState<{ chain: SourceChainKey; hash: string }>();
  const token = getTokenByKey(chain, tokenKey) ?? getDepositTokens(chain)[0];
  const parsed = parseTokenAmount(amount, tab === 'withdraw' ? 18 : (token?.decimals ?? 18));
  // A withdrawal spends shares on the holder's source chain; its selected network is only the destination.
  const signingChain = tab === 'withdraw' ? heldChain : chain;
  const wallet = useEvmWallet(signingChain);
  const depositQuote = useDepositQuote({
    vault: vault.vault,
    token: token?.address as Address | undefined,
    chain,
    amount: tab === 'deposit' ? parsed : undefined,
  });
  const withdrawQuote = useWithdrawQuote({
    vault: vault.vault,
    token: token?.address as Address | undefined,
    chain,
    shares: tab === 'withdraw' ? parsed : undefined,
  });
  const quote = tab === 'deposit' ? depositQuote : withdrawQuote;
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: execute, isPending } = useLeverageYieldVaultSwap();
  const choices = useMemo(() => getDepositTokens(chain), [chain]);
  const sourceTokens = useMemo(() => {
    const native = getDepositTokens(signingChain).find(
      item => item.address === '0x0000000000000000000000000000000000000000',
    );
    return [tab === 'deposit' ? token : undefined, native].filter((item): item is NonNullable<typeof item> => !!item);
  }, [signingChain, tab, token]);
  const balances = useBalances({
    params: { chainKey: signingChain, address: wallet.address, tokens: sourceTokens },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const status = useLeverageYieldDetailedStatus({
    params: { srcChainKey: submitted?.chain, srcTxHash: submitted?.hash },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const isOverShareBalance = tab === 'withdraw' && !!parsed && parsed > heldShares;
  const tokenBalance = token ? balances.data?.[token.address] : undefined;
  const nativeToken = sourceTokens.find(item => item.address === '0x0000000000000000000000000000000000000000');
  const nativeBalance = nativeToken ? balances.data?.[nativeToken.address] : undefined;
  const isNativeInput = token?.address === '0x0000000000000000000000000000000000000000';
  const insufficientInputBalance =
    tab === 'deposit' && !!parsed && (tokenBalance === undefined || tokenBalance < parsed);
  const insufficientGasReserve =
    !!wallet.address &&
    (nativeBalance === undefined ||
      nativeBalance < NATIVE_GAS_RESERVE[signingChain] + (tab === 'deposit' && isNativeInput ? (parsed ?? 0n) : 0n));
  const ready =
    !!wallet.address &&
    !!wallet.walletProvider &&
    !wallet.isWrongChain &&
    !!parsed &&
    !!quote.minimum &&
    !isOverShareBalance &&
    !insufficientInputBalance &&
    !insufficientGasReserve &&
    !balances.isLoading &&
    !balances.isError &&
    !isPending;

  const updateChain = (value: string) => {
    const next = value as SourceChainKey;
    setChain(next);
    setTokenKey(
      getDepositTokens(next).find(token => token.symbol === DEFAULT_TOKEN_KEY)?.symbol ??
        getDepositTokens(next)[0]?.symbol ??
        '',
    );
    setAmount('');
    setNotice(undefined);
    setSubmitted(undefined);
  };

  const submit = async () => {
    if (!ready || !wallet.address || !wallet.walletProvider || !parsed || !token || !quote.minimum) return;
    setNotice(undefined);
    const built =
      tab === 'deposit'
        ? await buildDeposit({
            vault: vault.vault,
            srcChainKey: chain,
            srcAddress: wallet.address,
            inputToken: token.address,
            inputAmount: parsed,
            minOutputAmount: quote.minimum,
          })
        : await buildWithdraw({
            vault: vault.vault,
            srcChainKey: heldChain,
            srcAddress: wallet.address,
            dstChainKey: chain,
            outputToken: token.address,
            inputAmount: parsed,
            minOutputAmount: quote.minimum,
          });
    if (!built.ok) {
      if (isUserRejectedError(built.error)) return;
      return setNotice('The vault order could not be prepared. Check the amount, network, and quote, then try again.');
    }

    if (tab === 'deposit') {
      const allowance = await sodax.swaps.isAllowanceValid({
        params: built.value.params,
        raw: false,
        walletProvider: wallet.walletProvider,
      });
      if (!allowance.ok) {
        if (isUserRejectedError(allowance.error)) return;
        return setNotice('We could not verify token approval. Please try again.');
      }
      if (!allowance.value) {
        const approval = await approve({ params: built.value.params, walletProvider: wallet.walletProvider });
        if (!approval.ok) {
          if (isUserRejectedError(approval.error)) return;
          return setNotice('Approval was not completed. No deposit was sent.');
        }
      }
    }

    const result = await execute({ ...built.value, walletProvider: wallet.walletProvider });
    if (!result.ok) {
      if (isUserRejectedError(result.error)) return;
      return setNotice('The vault order was not submitted. No funds were moved by this app.');
    }
    setSubmitted({
      chain: result.value.intentDeliveryInfo.srcChainKey as SourceChainKey,
      hash: result.value.intentDeliveryInfo.srcTxHash,
    });
    setNotice(
      'Order submitted. Keep this window open while SODAX delivers it to Sonic and an independent solver fills your vault shares.',
    );
  };

  const actionLabel = !wallet.isConnected
    ? 'Connect wallet'
    : wallet.isWrongChain
      ? `Switch to ${chainName(signingChain)}`
      : tab === 'deposit'
        ? 'Review & deposit'
        : 'Review & withdraw';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vault.name}</DialogTitle>
          <DialogDescription>
            Deposit into a pooled leveraged vault, or withdraw your shares to a supported network.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 rounded-md bg-muted p-1">
          {(['deposit', 'withdraw'] as const).map(value => (
            <button
              key={value}
              type="button"
              className={`rounded px-3 py-2 text-sm font-medium ${tab === value ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => {
                setTab(value);
                setAmount('');
                setNotice(undefined);
              }}
            >
              {value === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <span>Network</span>
          <Select value={chain} onValueChange={updateChain}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_CHAINS.map(value => (
                <SelectItem key={value} value={value}>
                  {chainName(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <span>{tab === 'deposit' ? 'Pay with' : 'Receive as'}</span>
          <Select value={token?.symbol ?? ''} onValueChange={setTokenKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map(choice => (
                <SelectItem key={choice.symbol} value={choice.symbol}>
                  {choice.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="grid gap-2 text-sm font-medium" htmlFor="vault-amount">
          {tab === 'deposit' ? 'Amount' : 'Vault shares'}
          <Input
            id="vault-amount"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            placeholder="0.00"
          />
          {tab === 'withdraw' && (
            <span className="text-xs font-normal text-muted-foreground">
              Available from this network: {formatTokenAmount(heldShares, 18)} shares
            </span>
          )}
        </label>
        {wallet.address && balances.isLoading && (
          <p className="text-sm text-muted-foreground">Checking wallet balance…</p>
        )}
        {insufficientInputBalance && (
          <p role="alert" className="text-sm text-destructive">
            Your {token?.symbol} balance on {chainName(signingChain)} is too low for this deposit.
          </p>
        )}
        {insufficientGasReserve && (
          <p role="alert" className="text-sm text-destructive">
            Keep at least {formatTokenAmount(NATIVE_GAS_RESERVE[signingChain], 18)} native tokens on{' '}
            {chainName(signingChain)} for gas.
          </p>
        )}
        <Callout variant="notice">
          Real funds: variable APR and leveraged-vault risk can reduce share value. You will always approve transactions
          in your own wallet.
        </Callout>
        {quote.isFetching && <p className="text-sm text-muted-foreground">Getting a live vault quote…</p>}
        {quote.data?.ok && quote.minimum && (
          <div className="rounded-md border bg-secondary/40 p-3 text-sm">
            <p>
              You receive ≈{' '}
              <strong>
                {formatTokenAmount(quote.data.value.quoted_amount, tab === 'deposit' ? 18 : (token?.decimals ?? 18))}{' '}
                {tab === 'deposit' ? 'shares' : token?.symbol}
              </strong>
            </p>
            <p className="mt-1 text-muted-foreground">
              Minimum accepted: {formatTokenAmount(quote.minimum, tab === 'deposit' ? 18 : (token?.decimals ?? 18))}{' '}
              {tab === 'deposit' ? 'shares' : token?.symbol}
            </p>
          </div>
        )}
        {isOverShareBalance && (
          <p role="alert" className="text-sm text-destructive">
            Choose no more than the shares held from this network.
          </p>
        )}
        {notice && (
          <p role="alert" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {submitted && (
          <p className="text-sm text-muted-foreground">
            {status.isFetching
              ? 'Tracking submission…'
              : status.data?.ok
                ? 'Order is being tracked by SODAX. Balances refresh as settlement completes.'
                : 'Order submitted; SODAX status is temporarily unavailable.'}{' '}
            {explorerTxUrl(submitted.chain, submitted.hash) && (
              <a
                className="underline"
                href={explorerTxUrl(submitted.chain, submitted.hash)}
                target="_blank"
                rel="noreferrer"
              >
                View source transaction
              </a>
            )}
          </p>
        )}
        <Button
          className="w-full"
          disabled={isPending || (!ready && wallet.isConnected && !wallet.isWrongChain)}
          onClick={() => {
            if (!wallet.isConnected) wallet.connect();
            else if (wallet.isWrongChain) wallet.switchChain();
            else void submit();
          }}
        >
          {isPending ? 'Submitting…' : actionLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
