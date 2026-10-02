import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Window } from '@/components/desktop/Window';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useVaultShares } from '../hooks/useVaults';
import { ASSET_DECIMALS, isInfiniteHealth, SHARE_DECIMALS, vaultMeta } from '../lib/vaults';

const WAD = 10n ** 18n;

export function VaultCard({
  vault,
  address,
  selected,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  selected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const meta = vaultMeta(vault);
  const params = { params: { vault: vault.vault } };
  const apr = useLeverageYieldEffectiveApr(params);
  const tvl = useLeverageYieldTotalAssets(params);
  const position = useLeverageYieldPosition(params);
  const sharePrice = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const shares = useVaultShares(vault, address);

  const netApr = apr.data?.effectiveNetAprRay;
  const leverage = apr.data ? apr.data.leverageMultiplierWad + WAD : undefined;
  const health = position.data?.healthFactor;
  const myValue = sharePrice.data !== undefined ? (shares.total * sharePrice.data) / ONE_SHARE : undefined;

  return (
    <Window
      id={`vault:${vault.name}`}
      title={`${vault.name.toLowerCase()}.exe`}
      className={cn(selected && 'ring-2 ring-primary ring-offset-4 ring-offset-background')}
      bodyClassName="gap-5 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-sm leading-relaxed text-primary">{vault.name}</h3>
          <p className="text-xs text-muted-foreground">{meta.blurb}</p>
        </div>
        <Badge variant="muted">{meta.asset}</Badge>
      </div>

      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Net APR
          <Tooltip
            content={
              apr.data
                ? `Staking ${formatRayPercent(apr.data.lsdApr.aprRay)} (${apr.data.lsdApr.label}${apr.data.lsdApr.stale ? ', estimate' : ''}) + supply ${formatRayPercent(apr.data.supplyAprRay)} − borrow ${formatRayPercent(apr.data.borrowAprRay)}, at ${formatBps(apr.data.targetLtvBps)} target LTV. Variable; can turn negative.`
                : 'Variable; can turn negative.'
            }
          >
            <InfoIcon className="size-3.5 cursor-help" />
          </Tooltip>
        </div>
        {netApr === undefined ? (
          <Skeleton className="mt-1 h-9 w-28" />
        ) : (
          <p className={cn('mt-1 font-display text-2xl', netApr < 0n ? 'text-destructive' : 'text-hero-accent')}>
            {formatRayPercent(netApr)}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Stat label="TVL" loading={tvl.data === undefined}>
          {formatTokenAmount(tvl.data, ASSET_DECIMALS, 2)} {meta.asset}
        </Stat>
        <Stat label="Share price" loading={sharePrice.data === undefined}>
          {formatTokenAmount(sharePrice.data, ASSET_DECIMALS)} {meta.asset}
        </Stat>
        <Stat label="Leverage" loading={leverage === undefined}>
          {formatWad(leverage)}×
        </Stat>
        <Stat label="Health" loading={health === undefined}>
          {health === undefined ? '' : isInfiniteHealth(health) ? '∞' : formatWad(health)}
          {position.data && (
            <span className="ml-1 text-xs text-muted-foreground">LTV {formatBps(position.data.ltv)}</span>
          )}
        </Stat>
      </dl>

      <div className="rounded-md bg-muted/60 px-4 py-3 text-sm">
        <div className="text-xs text-muted-foreground">Your shares</div>
        {!address ? (
          <div className="text-subtle-foreground">Connect to see your position</div>
        ) : shares.isLoading ? (
          <Skeleton className="mt-1 h-5 w-32" />
        ) : (
          <div className="font-semibold tabular-nums">
            {formatTokenAmount(shares.total, SHARE_DECIMALS)} {vault.name}
            {shares.total > 0n && myValue !== undefined && (
              <span className="ml-1 font-normal text-muted-foreground">
                ≈ {formatTokenAmount(myValue, ASSET_DECIMALS)} {meta.asset}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button onClick={onDeposit}>Deposit</Button>
        <Button variant="outline" onClick={onWithdraw} disabled={!address || shares.total === 0n}>
          Withdraw
        </Button>
      </div>
    </Window>
  );
}

function Stat({ label, loading, children }: { label: string; loading: boolean; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{loading ? <Skeleton className="mt-1 h-5 w-20" /> : children}</dd>
    </div>
  );
}
