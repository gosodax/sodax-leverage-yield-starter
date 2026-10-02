import { useLeverageYieldEffectiveApr, useLeverageYieldPosition, useLeverageYieldTotalAssets } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSharePrice } from '../hooks/useShareValue';
import { useVaultHoldings } from '../hooks/useVaultHoldings';
import { healthLabel, tierForLtv } from '../lib/tier';
import { formatShares, shareValue, underlying, vaultTagline, vaultTitle } from '../lib/vaults';
import { HealthPill } from './HealthPill';

/** A single vault in the browser: live APR, TVL, leverage, LTV, health and the user's holdings. */
export function VaultCard({
  vault,
  address,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { data: apr, isError: aprError } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl, isLoading: tvlLoading } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const { data: position } = useLeverageYieldPosition({ params: { vault: vault.vault } });
  const sharePrice = useSharePrice(vault.vault);
  const holdings = useVaultHoldings(vault.vault, address);

  const asset = underlying(vault);
  const tier = tierForLtv(apr?.targetLtvBps);
  const netApr = apr?.effectiveNetAprRay;
  const worth = shareValue(holdings.totalShares, sharePrice);

  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
      {/* Tier accent strip */}
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: tier.color }} aria-hidden />

      <div className="flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
          style={{ backgroundColor: `${tier.color}1f`, color: tier.color, borderColor: `${tier.color}3d` }}
          aria-hidden
        >
          {asset.symbol.replace(/^[a-z]+/, '').slice(0, 3) || asset.symbol.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold">{vaultTitle(vault)}</h3>
            <Badge variant="outline" style={{ color: tier.color, borderColor: `${tier.color}3d` }}>
              {tier.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{vaultTagline(vault)}</p>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          {netApr !== undefined ? (
            <p className={cn('font-display text-3xl font-bold', netApr < 0n ? 'text-destructive' : 'text-success')}>
              {formatRayPercent(netApr)}
            </p>
          ) : aprError ? (
            <p className="font-display text-3xl font-bold text-subtle-foreground">–</p>
          ) : (
            <Skeleton className="h-9 w-24" />
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Net APR
            {apr?.lsdApr.stale && <Badge variant="muted">estimate</Badge>}
          </p>
        </div>
        <div className="text-right">
          {tvl !== undefined ? (
            <p className="font-accent text-lg font-semibold tabular-nums">
              {formatTokenAmount(tvl, asset.decimals, 2)}
            </p>
          ) : tvlLoading ? (
            <Skeleton className="ml-auto h-6 w-16" />
          ) : (
            <p className="text-lg font-semibold text-subtle-foreground">–</p>
          )}
          <p className="text-xs text-muted-foreground">TVL · {asset.symbol}</p>
        </div>
      </div>

      {/* LTV meter: current vs target */}
      <LtvMeter ltv={position?.ltv} target={apr?.targetLtvBps} color={tier.color} />

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Leverage" value={apr ? `${formatWad(apr.leverageMultiplierWad)}×` : '–'} />
        <Stat label="Target LTV" value={formatBps(apr?.targetLtvBps)} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Health</span>
          <HealthPill health={healthLabel(position?.healthFactor)} />
        </div>
      </div>

      {address && (holdings.loading || holdings.totalShares > 0n) && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          {holdings.loading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p>
              <span className="text-muted-foreground">You hold </span>
              <span className="font-semibold">{formatShares(holdings.totalShares)}</span>
              {worth !== undefined && (
                <span className="text-muted-foreground">
                  {' '}
                  · ≈ {formatTokenAmount(worth, asset.decimals)} {asset.symbol}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <Button className="flex-1" onClick={onDeposit}>
          Deposit
        </Button>
        {holdings.totalShares > 0n && (
          <Button variant="outline" className="flex-1" onClick={onWithdraw}>
            Withdraw
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-accent font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Current LTV against the vault's target, as a thin meter. */
function LtvMeter({ ltv, target, color }: { ltv: bigint | undefined; target: bigint | undefined; color: string }) {
  const pct =
    ltv !== undefined && target !== undefined && target > 0n
      ? Math.min(100, Math.round((Number(ltv) / Number(target)) * 100))
      : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current LTV</span>
        <span className="font-accent tabular-nums">{formatBps(ltv)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct ?? 0}%`, backgroundColor: color }}
          aria-hidden
        />
      </div>
    </div>
  );
}
