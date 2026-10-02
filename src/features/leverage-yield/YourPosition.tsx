import { useLeverageYieldPreviewRedeem, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SOURCE_CHAINS } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { formatTokenAmount, ONE_SHARE } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { SHARE_DECIMALS } from './shared';
import { vaultUnderlyingSymbol } from './vaults';

/**
 * The user's shares in the selected vault, per source network. Shares are delivered to the
 * SODAX hub wallet derived from (network, address) — one per network deposited from — never
 * to the connected wallet itself.
 */
export function YourPosition({ vault }: { vault: LeverageYieldVault | undefined }) {
  const wallet = useEvmWallet();
  const holders = useMemo(
    () =>
      wallet.address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address: wallet.address as string })) : undefined,
    [wallet.address],
  );

  const holdings = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const totalShares = holdings.reduce((acc, query) => acc + (query.data?.shares ?? 0n), 0n);
  const loading = holdings.some(query => query.isLoading);

  const { data: sharePrice } = useLeverageYieldPreviewRedeem({
    params: { vault: vault?.vault, shares: ONE_SHARE },
  });
  const underlying = sharePrice !== undefined && totalShares > 0n ? (totalShares * sharePrice) / ONE_SHARE : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>
          {vault ? `${vault.name} shares, per source network.` : 'Select a vault to see your shares.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!wallet.isConnected ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground">Connect your wallet to see your shares.</p>
            <Button variant="outline" size="sm" onClick={wallet.connect}>
              Connect wallet
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">Total shares</span>
              <span className="font-mono text-base font-semibold">
                {formatTokenAmount(totalShares, SHARE_DECIMALS)} {vault?.name}
              </span>
            </div>
            {underlying !== undefined && vault && (
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>≈ underlying if you exited now</span>
                <span className="font-mono">
                  {formatTokenAmount(underlying, SHARE_DECIMALS)} {vaultUnderlyingSymbol(vault.name)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              {SOURCE_CHAINS.map((chainKey, index) => {
                const query = holdings[index];
                const shares = query?.data?.shares;
                return (
                  <div key={chainKey} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {chainLogo(chainKey) && <img src={chainLogo(chainKey)} alt="" className="size-4 rounded-full" />}
                      via {chainName(chainKey)}
                    </span>
                    <span className="font-mono">
                      {query?.isError ? '–' : formatTokenAmount(shares ?? 0n, SHARE_DECIMALS)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Shares live in your SODAX hub wallet on Sonic (one per source network), not in your browser wallet.
              Withdraw from the same network you deposited from.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
