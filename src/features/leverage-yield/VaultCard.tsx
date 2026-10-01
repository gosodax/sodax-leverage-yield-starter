import {
  type LeverageYieldShareHolder,
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { underlyingSymbol } from './vaults';

const WAD = 10n ** 18n;

/** Health factor for display: no debt reads as type(uint256).max. */
export function formatHealth(hf: bigint | undefined): string {
  if (hf === undefined) return '–';
  if (hf > 10n ** 30n) return '∞';
  return formatWad(hf);
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <InfoIcon className="size-3 cursor-help" />
          </Tooltip>
        )}
      </span>
      <span className="text-sm font-semibold tabular-nums">{children}</span>
    </div>
  );
}

function Loading({ value, children }: { value: unknown; children: ReactNode }) {
  return value === undefined ? <Skeleton className="h-5 w-16" /> : children;
}

/** Total shares of a vault the user holds across every source network's hub wallet. */
export function useTotalShares(vault: LeverageYieldVault, holders: LeverageYieldShareHolder[] | undefined) {
  const balances = useLeverageYieldShareBalances({ params: { vault: vault.vault, holders } });
  const loaded = holders !== undefined && balances.every(q => q.data !== undefined);
  return {
    total: balances.reduce((acc, q) => acc + (q.data?.shares ?? 0n), 0n),
    rows: balances.flatMap(q => (q.data && q.data.shares > 0n ? [q.data] : [])),
    loaded,
  };
}

export function VaultCard({
  vault,
  holders,
  selected,
  onDeposit,
}: {
  vault: LeverageYieldVault;
  holders: LeverageYieldShareHolder[] | undefined;
  selected: boolean;
  onDeposit: () => void;
}) {
  const params = { vault: vault.vault };
  const { data: apr } = useLeverageYieldEffectiveApr({ params });
  const { data: tvl } = useLeverageYieldTotalAssets({ params });
  const { data: position } = useLeverageYieldPosition({ params });
  const { data: sharePrice } = useLeverageYieldPreviewRedeem({ params: { ...params, shares: ONE_SHARE } });
  const { total, loaded } = useTotalShares(vault, holders);

  const asset = underlyingSymbol(vault.name);
  const negative = apr !== undefined && apr.effectiveNetAprRay < 0n;
  const leverage = apr ? apr.leverageMultiplierWad + WAD : undefined;
  const value = sharePrice !== undefined ? (total * sharePrice) / ONE_SHARE : undefined;

  return (
    <Card
      className={cn(
        'flex flex-col gap-4 p-5 transition-shadow',
        selected ? 'border-primary ring-2 ring-ring' : 'hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-xl font-bold">{asset}</span>
          <span className="font-mono text-xs text-muted-foreground">{vault.name}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-muted-foreground">Net APR</span>
          <Loading value={apr}>
            <span className={cn('text-2xl font-bold tabular-nums', negative ? 'text-destructive' : 'text-success')}>
              {formatRayPercent(apr?.effectiveNetAprRay)}
            </span>
          </Loading>
          {apr?.lsdApr.stale && (
            <Badge variant="muted" className="mt-1">
              staking yield estimated
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-y py-3">
        <Stat label="TVL" hint={`Total assets in the vault, in ${asset}.`}>
          <Loading value={tvl}>
            {formatTokenAmount(tvl, 18, 2)} <span className="text-xs font-normal text-muted-foreground">{asset}</span>
          </Loading>
        </Stat>
        <Stat label="Share price" hint={`${asset} redeemable for one ${vault.name} share. Rises as the vault earns.`}>
          <Loading value={sharePrice}>{formatTokenAmount(sharePrice, 18, 4)}</Loading>
        </Stat>
        <Stat label="Leverage" hint="Your exposure: 1 + the borrowed multiple at the vault's target loan-to-value.">
          <Loading value={leverage}>{formatWad(leverage)}×</Loading>
        </Stat>
        <Stat
          label="LTV"
          hint={`Current loan-to-value of the vault's position. Target: ${formatBps(apr?.targetLtvBps, 1)}.`}
        >
          <Loading value={position}>{formatBps(position?.ltv, 1)}</Loading>
        </Stat>
        <Stat label="Health" hint="Aave health factor of the vault's position. Below 1.0 it can be liquidated.">
          <Loading value={position}>{formatHealth(position?.healthFactor)}</Loading>
        </Stat>
        <Stat label="Staking APR" hint={apr?.lsdApr.label}>
          <Loading value={apr}>{formatRayPercent(apr?.lsdApr.aprRay)}</Loading>
        </Stat>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Your shares</span>
          {holders === undefined ? (
            <span className="text-sm text-muted-foreground">Connect to see</span>
          ) : !loaded ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="text-sm font-semibold tabular-nums">
              {formatTokenAmount(total, 18)}
              {total > 0n && value !== undefined && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  ≈ {formatTokenAmount(value, 18)} {asset}
                </span>
              )}
            </span>
          )}
        </div>
        <Button size="sm" variant={selected ? 'default' : 'outline'} onClick={onDeposit}>
          Deposit
        </Button>
      </div>
    </Card>
  );
}
