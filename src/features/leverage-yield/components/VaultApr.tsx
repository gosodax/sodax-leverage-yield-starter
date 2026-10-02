import { useLeverageYieldEffectiveApr } from '@sodax/dapp-kit';
import type { Address } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { ThinkingOrb } from '@/components/ui/thinking-orb';
import { Tooltip } from '@/components/ui/tooltip';
import { formatRayPercent } from '@/lib/format';

/** Headline APR: `effectiveNetAprRay` (AAVE spread + LSD staking yield, levered). */
export function VaultApr({ vault, className }: { vault: Address; className?: string }) {
  const { data: apr, isLoading, isError } = useLeverageYieldEffectiveApr({ params: { vault } });
  if (isLoading) return <ThinkingOrb state="breathing" size={20} label="Loading APR" />;
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
