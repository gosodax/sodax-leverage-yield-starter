import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useHolders, type Vault, vaultAssetLabel } from './vaults';

const WAD = 10n ** 18n;

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? <Skeleton className="h-5 w-16" />}</dd>
    </div>
  );
}

export function VaultCard({ vault, selected, onDeposit }: { vault: Vault; selected: boolean; onDeposit: () => void }) {
  const { address } = useEvmWallet();
  const holders = useHolders(address);
  const label = vaultAssetLabel(vault.name);
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } }).data;
  const tvl = useLeverageYieldTotalAssets({ params: { vault: vault.vault } }).data;
  const price = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } }).data;
  const position = useLeverageYieldPosition({ params: { vault: vault.vault } }).data;
  const balances = useLeverageYieldShareBalances({ params: { vault: vault.vault, holders } });
  const mine = balances.reduce((acc, q) => acc + (q.data?.shares ?? 0n), 0n);

  const hf =
    position === undefined
      ? undefined
      : position.healthFactor >= 10n ** 36n
        ? 'No debt'
        : formatWad(position.healthFactor);
  const negative = apr !== undefined && apr.effectiveNetAprRay < 0n;

  return (
    <Card className={selected ? 'ring-2 ring-primary' : undefined}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{vault.name}</CardTitle>
        {mine > 0n && <Badge variant="success">{formatTokenAmount(mine, 18, 4)} shares</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Net APR (variable)" value={apr && formatRayPercent(apr.effectiveNetAprRay)} />
          <Stat label="TVL" value={tvl === undefined ? undefined : `${formatTokenAmount(tvl, 18, 2)} ${label}`} />
          <Stat
            label="Share price"
            value={price === undefined ? undefined : `${formatTokenAmount(price, 18, 4)} ${label}`}
          />
          <Stat label="Leverage" value={apr && `${formatWad(WAD + apr.leverageMultiplierWad)}×`} />
          <Stat label="Health factor" value={hf} />
          <Stat label="Target LTV" value={apr && formatBps(apr.targetLtvBps)} />
        </dl>
        {negative && <Badge variant="destructive">Net APR is negative</Badge>}
        <Button variant={selected ? 'secondary' : 'default'} onClick={onDeposit}>
          Deposit
        </Button>
      </CardContent>
    </Card>
  );
}
