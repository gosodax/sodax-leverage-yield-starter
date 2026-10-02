import { useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault } from '@sodax/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
import { useTweenedBigint } from '@/components/ui/motion';
import { OrbPanel } from '@/components/ui/thinking-orb';
import type { SourceChainKey } from '@/config/workshop';
import { chainName, explorerAddressUrl } from '@/lib/chains';
import { formatTokenAmount, shortenAddress } from '@/lib/format';
import { useShareValue } from '../hooks/useShareValue';
import { vaultBrand } from '../lib/brands';
import { SHARE_DECIMALS, underlying } from '../lib/vaults';
import { WithdrawDialog } from './WithdrawDialog';

/**
 * The user's shares in one vault, for deposits made from one chain.
 *
 * Shares are NOT in the user's wallet: they sit in the SODAX hub wallet on Sonic derived from
 * (source chain, address). `useLeverageYieldShareBalances` resolves that hub wallet for you.
 */
export function PositionCard({
  vault,
  chainKey,
  address,
}: {
  vault: LeverageYieldVault;
  chainKey: SourceChainKey;
  address: string | undefined;
}) {
  const [balance] = useLeverageYieldShareBalances({
    params: { vault: vault.vault, holders: address ? [{ chainKey, address }] : undefined },
  });
  const holding = balance?.data;
  const value = useShareValue(vault.vault, holding?.shares || undefined);
  const asset = underlying(vault);
  const brand = vaultBrand(vault);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const shownShares = useTweenedBigint(holding?.shares);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>
          {brand.name}, deposits from {chainName(chainKey)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!address ? (
          <p className="text-sm text-muted-foreground">Connect a wallet to see your shares.</p>
        ) : !holding ? (
          <OrbPanel state="breathing" className="py-4">
            Loading your position
          </OrbPanel>
        ) : (
          <>
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {formatTokenAmount(shownShares ?? holding.shares, SHARE_DECIMALS)}
              </p>
              <p className="text-sm text-muted-foreground">shares of {vault.name}</p>
            </div>
            {value !== undefined && (
              <p className="text-sm">
                Worth ≈ {formatTokenAmount(value, asset.decimals)} {brand.ticker}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Held by your hub wallet{' '}
              <a
                href={explorerAddressUrl(ChainKeys.SONIC_MAINNET, holding.holder)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-foreground underline decoration-link decoration-2 underline-offset-4 hover:decoration-primary"
              >
                {shortenAddress(holding.holder)}
              </a>{' '}
              on Sonic{' '}
              <InfoTip label="Why your wallet app doesn't show these">
                Your shares sit in your own SODAX hub wallet on Sonic, which only your wallet controls. They won't
                appear in your wallet app; this card shows them.
              </InfoTip>
            </p>
            {holding.shares > 0n && (
              <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
                Withdraw
              </Button>
            )}
            {withdrawOpen && (
              <WithdrawDialog
                vault={vault}
                chainKey={chainKey}
                shareBalance={holding.shares}
                onClose={() => setWithdrawOpen(false)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
