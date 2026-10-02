import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldTotalAssets,
  useSodaxContext,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useShareHoldings } from './usePosition';

const NO_DEBT_HEALTH = 2n ** 255n;
const WAD = 10n ** 18n;

type Props = { selected: string; onSelect: (name: string) => void };

export function VaultBrowser({ selected, onSelect }: Props) {
  const { sodax } = useSodaxContext();
  const vaults = sodax.leverageYield.listVaults();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {vaults.map(vault => (
        <VaultCard key={vault.name} vault={vault} selected={vault.name === selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value ?? <Skeleton className="h-5 w-16" />}</dd>
    </div>
  );
}

function VaultCard({
  vault,
  selected,
  onSelect,
}: {
  vault: LeverageYieldVault;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const tvl = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const sharePrice = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const position = useLeverageYieldPosition({ params: { vault: vault.vault } });
  const { total } = useShareHoldings(vault.vault);

  const health = position.data?.healthFactor;
  const underlying = vault.name.replace(/^lsoda/i, '');

  return (
    <Card className={cn(selected && 'ring-2 ring-primary')}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{vault.name}</CardTitle>
        {total > 0n ? <Badge>You hold {formatTokenAmount(total, 18, 4)}</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Stat
            label="Effective APR"
            value={apr.isError ? '–' : apr.data && formatRayPercent(apr.data.effectiveNetAprRay)}
          />
          <Stat
            label="TVL"
            value={
              tvl.isError
                ? '–'
                : tvl.data !== undefined
                  ? `${formatTokenAmount(tvl.data, 18, 2)} ${underlying}`
                  : undefined
            }
          />
          <Stat
            label="Share price"
            value={
              sharePrice.isError
                ? '–'
                : sharePrice.data !== undefined
                  ? `${formatTokenAmount(sharePrice.data, 18, 4)} ${underlying}`
                  : undefined
            }
          />
          <Stat
            label="Leverage"
            value={apr.isError ? '–' : apr.data && `${formatWad(WAD + apr.data.leverageMultiplierWad)}×`}
          />
          <Stat
            label="Health factor"
            value={
              position.isError
                ? '–'
                : health === undefined
                  ? undefined
                  : health >= NO_DEBT_HEALTH
                    ? 'No debt'
                    : formatWad(health)
            }
          />
        </dl>
        <Button variant={selected ? 'secondary' : 'default'} onClick={() => onSelect(vault.name)}>
          {selected ? 'Selected' : 'Deposit'}
        </Button>
      </CardContent>
    </Card>
  );
}
