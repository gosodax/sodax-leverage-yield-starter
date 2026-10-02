import { InfoIcon } from 'lucide-react';
import { maxUint256 } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatUsd, TokenBadge } from './parts';
import {
  exposureWad,
  SHARE_DECIMALS,
  shareValue,
  toUsd,
  useShareHoldings,
  useUsdPrice,
  useVaultStats,
  type VaultMeta,
} from './vaults';

const WAD = 10n ** 18n;

function healthTone(hf: bigint | undefined): 'success' | 'default' | 'destructive' | 'muted' {
  if (hf === undefined) return 'muted';
  if (hf === maxUint256 || hf >= (WAD * 115n) / 100n) return 'success';
  if (hf >= (WAD * 105n) / 100n) return 'default';
  return 'destructive';
}

function Stat({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip content={hint}>
        <span className="flex w-fit cursor-help items-center gap-1 text-xs text-muted-foreground">
          {label}
          <InfoIcon className="size-3 opacity-60" />
        </span>
      </Tooltip>
      <span className="text-sm font-semibold tabular-nums">{children}</span>
    </div>
  );
}

export function VaultCard({
  meta,
  address,
  onDeposit,
  onWithdraw,
}: {
  meta: VaultMeta;
  address: string | undefined;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { apr, tvl, position, pricePerShare, isLoading } = useVaultStats(meta.vault.vault);
  const holdings = useShareHoldings(meta.vault.vault, address);
  const priceOf = useUsdPrice();
  const assetPrice = priceOf(meta.vault.asset);
  const aprRay = apr?.effectiveNetAprRay;
  const negative = aprRay !== undefined && aprRay < 0n;
  const myAssets = pricePerShare !== undefined ? shareValue(holdings.total, pricePerShare) : undefined;
  const hf = position?.healthFactor;

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex items-center gap-3">
          <TokenBadge symbol={meta.assetSymbol} className="size-11 text-base" />
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold leading-tight">{meta.assetSymbol}</span>
            <span className="text-xs text-muted-foreground">
              {meta.shareSymbol}
              {meta.lsdLabel && ` · ${meta.lsdLabel}`}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <span className={cn('text-3xl font-bold tabular-nums', negative ? 'text-destructive' : 'text-primary')}>
              {formatRayPercent(aprRay)}
            </span>
          )}
          <Tooltip
            content={`Net APR at today's rates: staking yield plus leverage, minus borrow cost. Variable; it can go negative.${
              apr?.lsdApr.stale ? ' Staking yield is a fallback estimate right now.' : ''
            }`}
          >
            <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
              Variable APR{apr?.lsdApr.stale && ' (est.)'}
              <InfoIcon className="size-3 opacity-60" />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y bg-secondary/40 px-5 py-4 sm:grid-cols-4">
        <Stat label="TVL" hint="Total assets the vault manages.">
          {tvl === undefined ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span title={`${formatTokenAmount(tvl, meta.assetDecimals)} ${meta.assetSymbol}`}>
              {formatUsd(toUsd(tvl, meta.assetDecimals, assetPrice), true)}
              <span className="block text-xs font-normal text-muted-foreground">
                {formatTokenAmount(tvl, meta.assetDecimals, 2)} {meta.assetSymbol}
              </span>
            </span>
          )}
        </Stat>
        <Stat
          label="Exposure"
          hint={`Exposure to ${meta.assetSymbol} per unit deposited (1 + borrowed multiple), at the target LTV of ${formatBps(apr?.targetLtvBps)}.`}
        >
          {apr ? `${formatWad(exposureWad(apr.leverageMultiplierWad))}×` : <Skeleton className="h-5 w-12" />}
          {position && (
            <span className="block text-xs font-normal text-muted-foreground">LTV {formatBps(position.ltv)}</span>
          )}
        </Stat>
        <Stat label="Health" hint="The vault's Aave health factor. Below 1.00 the position can be liquidated.">
          {hf === undefined ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <Badge variant={healthTone(hf)} className="mt-0.5">
              {hf === maxUint256 ? 'No debt' : formatWad(hf)}
            </Badge>
          )}
        </Stat>
        <Stat label="Share price" hint={`${meta.assetSymbol} redeemable for one ${meta.shareSymbol} share.`}>
          {pricePerShare === undefined ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <>
              {formatTokenAmount(pricePerShare, meta.assetDecimals, 4)}
              <span className="block text-xs font-normal text-muted-foreground">{meta.assetSymbol}</span>
            </>
          )}
        </Stat>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Your shares</span>
          {!address ? (
            <span className="text-subtle-foreground">Connect to see</span>
          ) : holdings.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : holdings.total > 0n ? (
            <span className="text-right font-semibold tabular-nums">
              {formatTokenAmount(holdings.total, SHARE_DECIMALS)}
              <span className="ml-1 font-normal text-muted-foreground">
                ≈ {formatUsd(toUsd(myAssets, meta.assetDecimals, assetPrice))}
              </span>
            </span>
          ) : (
            <span className="text-subtle-foreground">None yet</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onDeposit}>
            Deposit
          </Button>
          {holdings.total > 0n && (
            <Button variant="outline" className="flex-1" onClick={onWithdraw}>
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
