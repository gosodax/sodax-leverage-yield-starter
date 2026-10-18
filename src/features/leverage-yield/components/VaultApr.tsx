import { useLeverageYieldEffectiveApr } from '@sodax/dapp-kit';
import type { Address } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatRayPercent } from '@/lib/format';

/** Headline APR: `effectiveNetAprRay` (AAVE spread + LSD staking yield, levered). */
export function VaultApr({ vault, className }: { vault: Address; className?: string }) {
  const { data: apr, isLoading, isError } = useLeverageYieldEffectiveApr({ params: { vault } });
  if (isLoading) return <Skeleton className="h-5 w-14" />;
  if (isError || !apr) return <span className="text-subtle-foreground">APR n/a</span>;
  return (
    <span className={className}>
      {formatRayPercent(apr.effectiveNetAprRay)} APR
      {apr.lsdApr.stale && (
        <Tooltip content="The staking-yield feed is stale, so this APR uses a fallback estimate.">
          <Badge variant="muted" className="ml-1.5 align-middle">
            estimate
          </Badge>
        </Tooltip>
      )}
    </span>
  );
}
