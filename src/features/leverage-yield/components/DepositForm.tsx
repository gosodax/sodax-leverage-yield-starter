import { isNativeToken } from '@sodax/types';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_VAULT_NAME,
  isSourceChain,
  NATIVE_GAS_RESERVE,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useDepositQuote } from '../hooks/useDepositQuote';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useTokenChoice } from '../hooks/useTokenChoice';
import { useVault, useVaults } from '../hooks/useVaults';
import { ChainSelect } from './ChainSelect';
import { DepositDialog, type DepositReview } from './DepositDialog';
import { PositionCard } from './PositionCard';
import { QuoteDetails } from './QuoteDetails';
import { QuoteError } from './QuoteError';
import { RiskNotice } from './RiskNotice';
import { TokenSelect } from './TokenSelect';
import { VaultApr } from './VaultApr';
import { VaultPicker } from './VaultPicker';

/** Deposit card plus the user's position for the selected vault and source chain. */
export function DepositForm({
  vaultName: controlledName,
  onVaultChange,
}: {
  /** Controlled vault selection (so the vault browser can target this form). Falls back to internal state. */
  vaultName?: string;
  onVaultChange?: (name: string) => void;
} = {}) {
  const vaults = useVaults();
  const [internalName, setInternalName] = useState(DEFAULT_VAULT_NAME);
  const vaultName = controlledName ?? internalName;
  const setVaultName = onVaultChange ?? setInternalName;
  const vault = useVault(vaultName) ?? vaults[0];

  // Source chain: the user's pick, else the wallet's current chain if allowed, else the default.
  const { currentChainKey } = useEvmWallet();
  const [pickedChain, setPickedChain] = useState<SourceChainKey>();
  const chainKey = pickedChain ?? (isSourceChain(currentChainKey) ? currentChainKey : DEFAULT_SOURCE_CHAIN);
  const wallet = useEvmWallet(chainKey);
  const { tokens, token, pickToken } = useTokenChoice(chainKey);

  const [amountText, setAmountText] = useState('');
  const inputAmount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const { balance, isLoading: balanceLoading } = useTokenBalance(chainKey, token, wallet.address);

  // Inputs the user is reviewing. While the dialog is open it quotes them itself, so the form stops quoting.
  const [review, setReview] = useState<DepositReview | null>(null);
  const quote = useDepositQuote({ vault, srcChainKey: chainKey, token, inputAmount: review ? undefined : inputAmount });

  const action = (() => {
    if (!wallet.isConnected) return { label: 'Connect wallet', onClick: wallet.connect };
    if (wallet.isWrongChain) return { label: `Switch to ${chainName(chainKey)}`, onClick: wallet.switchChain };
    if (!amountText) return { label: 'Enter an amount', disabled: true };
    if (!inputAmount) return { label: 'Enter a valid amount', disabled: true };
    if (balance !== undefined && inputAmount > balance)
      return { label: `Insufficient ${token?.symbol}`, disabled: true };
    if (
      balance !== undefined &&
      token &&
      isNativeToken(chainKey, token) &&
      inputAmount > balance - NATIVE_GAS_RESERVE[chainKey]
    )
      return { label: `Leave some ${token.symbol} for gas`, disabled: true };
    if (quote.isLoading) return { label: 'Getting quote…', disabled: true };
    if (!vault || !token || quote.error || quote.amountOut === undefined || quote.minAmountOut === undefined) {
      return { label: 'No quote', disabled: true };
    }
    const reviewed = { vault, token, chainKey, inputAmount };
    return { label: 'Review deposit', onClick: () => setReview(reviewed) };
  })();

  if (!vault || !token) return null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardHeader>
          <CardTitle>Deposit</CardTitle>
          <CardDescription>Choose a vault and pay with a token from the network you already use.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Vault</span>
              <VaultApr vault={vault.vault} className="font-semibold text-primary" />
            </div>
            <VaultPicker vaults={vaults} value={vault.name} onChange={setVaultName} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">From network</span>
              <ChainSelect value={chainKey} onChange={setPickedChain} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Pay with</span>
              <TokenSelect tokens={tokens} value={token.address} onChange={pickToken} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="deposit-amount" className="font-medium">
                Amount
              </label>
              {wallet.isConnected && (
                <span className="text-muted-foreground">
                  Balance:{' '}
                  {balanceLoading ? (
                    <Skeleton className="inline-block h-3 w-12 align-middle" />
                  ) : (
                    `${formatTokenAmount(balance, token.decimals)} ${token.symbol}`
                  )}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="deposit-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountText}
                onChange={event => setAmountText(event.target.value)}
                className="h-14 pr-20 text-xl"
              />
              {/* No Max for the native token: the user needs some of it for gas. */}
              {balance !== undefined && balance > 0n && !isNativeToken(chainKey, token) && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setAmountText(formatUnits(balance, token.decimals))}
                >
                  Max
                </Button>
              )}
            </div>
          </div>

          {inputAmount && quote.error ? (
            <QuoteError message={quote.error} onRetry={quote.refetch} />
          ) : inputAmount && quote.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : inputAmount && quote.amountOut !== undefined && quote.minAmountOut !== undefined ? (
            <QuoteDetails
              vault={vault}
              token={token}
              inputAmount={inputAmount}
              shares={quote.amountOut}
              minShares={quote.minAmountOut}
            />
          ) : null}

          <RiskNotice />

          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PositionCard vault={vault} chainKey={chainKey} address={wallet.address} />

      {review && (
        <DepositDialog
          review={review}
          onClose={completed => {
            setReview(null);
            if (completed) setAmountText('');
          }}
        />
      )}
    </div>
  );
}
