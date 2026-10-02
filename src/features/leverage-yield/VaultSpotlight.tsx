import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { maxUint256 } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OVERLINE } from './shared';
import { vaultDescription, vaultUnderlyingSymbol } from './vaults';

function Stat({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn(OVERLINE, 'whitespace-nowrap')}>{label}</span>
      {value === undefined ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <span className={cn('whitespace-nowrap font-mono text-lg leading-tight', valueClassName)}>{value}</span>
      )}
    </div>
  );
}

/** Dashboard header for the selected vault: identity on the left, a Swiss stat row on the right. */
export function VaultSpotlight({ vault }: { vault: LeverageYieldVault }) {
  const { data: apr } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const { data: sharePrice } = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const { data: position } = useLeverageYieldPosition({ params: { vault: vault.vault } });

  const underlying = vaultUnderlyingSymbol(vault.name);
  const negativeApr = apr !== undefined && apr.effectiveNetAprRay < 0n;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className={OVERLINE}>Vault</span>
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-bold leading-none sm:text-3xl">{vault.name}</h2>
          <Badge>{underlying}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{vaultDescription(vault.name)}</p>
      </div>

      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 border-t border-border pt-4 lg:justify-end lg:border-t-0 lg:pt-0">
        <Stat
          label="Net APR"
          value={apr === undefined ? undefined : formatRayPercent(apr.effectiveNetAprRay)}
          valueClassName={cn('text-2xl font-semibold', negativeApr ? 'text-destructive' : 'text-success')}
        />
        <Stat label="TVL" value={tvl === undefined ? undefined : `${formatTokenAmount(tvl, 18, 2)} ${underlying}`} />
        <Stat label="Share price" value={sharePrice === undefined ? undefined : formatTokenAmount(sharePrice, 18, 5)} />
        <Stat
          label="Leverage"
          value={apr === undefined ? undefined : `${formatWad(apr.leverageMultiplierWad + ONE_SHARE)}×`}
        />
        <Stat
          label="LTV / target"
          value={
            position === undefined || apr === undefined
              ? undefined
              : `${formatBps(position.ltv, 1)} / ${formatBps(apr.targetLtvBps, 0)}`
          }
        />
        <Stat
          label="Health"
          value={
            position === undefined
              ? undefined
              : position.healthFactor === maxUint256
                ? '∞'
                : formatWad(position.healthFactor)
          }
        />
      </div>
    </Card>
  );
}
