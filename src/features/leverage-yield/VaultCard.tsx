import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import { InfoIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBps, formatRayPercent, formatTokenAmount, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FlashValue } from './motion';
import { Stat } from './parts';
import { formatExposure, formatHealthFactor, formatUsd, SHARE_DECIMALS, shareValue, toUsd } from './units';
import { useHolders } from './useHolders';
import { useAssetUsdPrice, type VaultInfo } from './useVaults';

/** One vault: live APR, TVL, share price, leverage and health, plus the connected user's shares. */
export function VaultCard({
  info,
  index,
  address,
  selected,
  onDeposit,
}: {
  info: VaultInfo;
  /** Position in the grid, for the staggered entrance. */
  index: number;
  address: string | undefined;
  selected: boolean;
  onDeposit: () => void;
}) {
  const vault = info.vault.vault;
  // Default intervals on purpose: one APR refresh is six Sonic calls plus an LSD fetch per vault.
  const apr = useLeverageYieldEffectiveApr({ params: { vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault } });
  const { data: position } = useLeverageYieldPosition({ params: { vault } });
  const { data: pricePerShare } = useLeverageYieldPreviewRedeem({ params: { vault, shares: ONE_SHARE } });
  const price = useAssetUsdPrice(info.vault.asset);
  const holders = useHolders(address);
  const balances = useLeverageYieldShareBalances({ params: { vault, holders } });

  const myShares = balances.reduce((sum, q) => sum + (q.data?.shares ?? 0n), 0n);
  const sharesLoading = balances.some(q => q.isLoading);
  const myAssets = pricePerShare !== undefined ? shareValue(myShares, pricePerShare) : undefined;

  const data = apr.data;
  const negative = data !== undefined && data.effectiveNetAprRay < 0n;

  return (
    <Card
      className={cn(
        'ls-rise flex flex-col transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
        selected && 'ring-2 ring-primary',
      )}
      style={{ '--ls-delay': `${index * 70}ms` } as CSSProperties}
    >
      <CardHeader className="flex-row items-center gap-3 pb-4">
        <img src={info.logo} alt="" className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate font-mono text-lg font-semibold leading-tight">{info.shareSymbol}</h3>
          <span className="text-sm text-muted-foreground">Leveraged {info.assetSymbol}</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-md bg-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Net APR
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {data?.lsdApr.stale ? 'estimate' : 'variable'}
            </Badge>
            {data && (
              <Tooltip
                content={`Staking ${formatRayPercent(data.lsdApr.aprRay)} (${data.lsdApr.label}) plus lending ${formatRayPercent(data.supplyAprRay)}, minus borrowing ${formatRayPercent(data.borrowAprRay)}, at ${formatExposure(data.leverageMultiplierWad)} exposure. Assumes today's rates hold; it can go negative.`}
              >
                <button type="button" aria-label="How the APR is computed" className="text-subtle-foreground">
                  <InfoIcon className="size-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
          {apr.isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : apr.isError ? (
            <span className="text-sm text-destructive">APR unavailable</span>
          ) : (
            <FlashValue
              value={data?.effectiveNetAprRay}
              className={cn(
                'w-fit px-1 font-mono text-3xl font-semibold tabular-nums',
                negative ? 'text-destructive' : 'text-success',
              )}
            >
              {negative ? '▼' : '▲'} {formatRayPercent(data?.effectiveNetAprRay)}
            </FlashValue>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat
            label="TVL"
            value={
              tvl === undefined ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                `${formatTokenAmount(tvl, info.assetDecimals, 2)} ${info.assetSymbol}`
              )
            }
            hint={tvl !== undefined && formatUsd(toUsd(tvl, info.assetDecimals, price))}
          />
          <Stat
            label="Share price"
            value={
              pricePerShare === undefined ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                `${formatTokenAmount(pricePerShare, info.assetDecimals)} ${info.assetSymbol}`
              )
            }
            hint={pricePerShare !== undefined && formatUsd(toUsd(pricePerShare, info.assetDecimals, price))}
          />
          <Stat
            label="Leverage (exposure)"
            value={data ? formatExposure(data.leverageMultiplierWad) : <Skeleton className="h-5 w-12" />}
            hint={data && `Target LTV ${formatBps(data.targetLtvBps)}`}
          />
          <Stat
            label="Health factor"
            value={position ? formatHealthFactor(position.healthFactor) : <Skeleton className="h-5 w-12" />}
            hint={position && `LTV ${formatBps(position.ltv)}`}
          />
        </div>

        {address && (
          <div className="flex items-baseline justify-between gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Your shares</span>
            {sharesLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="text-right font-mono font-medium tabular-nums">
                {formatTokenAmount(myShares, SHARE_DECIMALS)}
                {myShares > 0n && myAssets !== undefined && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({formatUsd(toUsd(myAssets, info.assetDecimals, price))})
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button className="w-full" variant={selected ? 'default' : 'outline'} onClick={onDeposit}>
          Deposit
        </Button>
      </CardFooter>
    </Card>
  );
}
