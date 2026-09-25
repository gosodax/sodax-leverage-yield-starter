import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { SOURCE_CHAINS } from '@/config/workshop';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSharePrice } from '../hooks/useShareValue';
import { SHARE_DECIMALS, underlying, yieldSource } from '../lib/vaults';

/** One vault: live APR, TVL, share price, leverage and health, plus the user's shares across source chains. */
export function VaultCard({
  vault,
  address,
  selected,
  onDeposit,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  selected?: boolean;
  onDeposit: () => void;
}) {
  const { data: apr, isError: aprError } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const sharePrice = useSharePrice(vault.vault);
  const { data: position } = useLeverageYieldPosition({ params: { vault: vault.vault } });

  // Deposits from each chain land in a different hub wallet, so sum across all source chains.
  const balances = useLeverageYieldShareBalances({
    params: {
      vault: vault.vault,
      holders: address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined,
    },
  });
  const myShares = balances.reduce((sum, query) => sum + (query.data?.shares ?? 0n), 0n);
  const { symbol, decimals } = underlying(vault);

  return (
    <Card className={cn('flex flex-col', selected && 'ring-2 ring-primary')}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{symbol}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {vault.name} · {yieldSource(vault)}
            </p>
          </div>
          {apr?.lsdApr.stale && <Badge variant="muted">APR estimate</Badge>}
        </div>
        <div className="pt-2">
          {apr ? (
            <p className="text-3xl font-bold text-primary">{formatRayPercent(apr.effectiveNetAprRay)}</p>
          ) : aprError ? (
            <p className="text-3xl font-bold text-subtle-foreground">–</p>
          ) : (
            <Skeleton className="h-9 w-24" />
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Net APR
            <Tooltip content="Staking yield of the underlying asset plus the lending spread, multiplied by the vault's leverage. Variable; can turn negative.">
              <InfoIcon className="size-3.5" />
            </Tooltip>
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Stat label="TVL" value={tvl !== undefined && `${formatTokenAmount(tvl, decimals, 2)} ${symbol}`} />
          <Stat
            label="Share price"
            value={sharePrice !== undefined && `${formatTokenAmount(sharePrice, decimals)} ${symbol}`}
          />
          <Stat label="Leverage" value={apr && `${formatWad(apr.leverageMultiplierWad)}×`} />
          <Stat
            label="Health / LTV"
            value={position && `${formatWad(position.healthFactor)} / ${formatBps(position.ltv)}`}
          />
          {address && (
            <Stat
              label="You hold"
              value={`${formatTokenAmount(myShares, SHARE_DECIMALS)} shares`}
              className="col-span-2"
            />
          )}
        </dl>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant={selected ? 'default' : 'outline'} onClick={onDeposit}>
          {selected ? 'Selected' : 'Deposit'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || <Skeleton className="mt-1 h-4 w-16" />}</dd>
    </div>
  );
}
