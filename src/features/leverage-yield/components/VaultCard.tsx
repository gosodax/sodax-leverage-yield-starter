import {
  type LeverageYieldVault,
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import { maxUint256 } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';

export function VaultCard({
  vault,
  address,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  address?: string;
  onDeposit(): void;
  onWithdraw(chain: SourceChainKey, shares: bigint): void;
}) {
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const position = useLeverageYieldPosition({ params: { vault: vault.vault } });
  const assets = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const sharePrice = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const shares = useLeverageYieldShareBalances({
    params: { vault: vault.vault, holders: address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : [] },
  });
  const totalShares = shares.reduce((sum, query) => sum + (query.data?.shares ?? 0n), 0n);
  const holdings = shares.flatMap(query => (query.data && query.data.shares > 0n ? [query.data] : []));
  // Exposure is a target-strategy metric returned with the APR snapshot, not the live position read.
  const exposure = apr.data ? 10n ** 18n + apr.data.leverageMultiplierWad : undefined;
  const health = position.data?.healthFactor;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{vault.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Pooled {vault.lsdSource?.label ?? 'staking'} strategy</p>
          </div>
          <Badge variant="success">{formatRayPercent(apr.data?.effectiveNetAprRay)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <Metric label="TVL" value={formatTokenAmount(assets.data, 18)} />
        <Metric label="Share price" value={formatTokenAmount(sharePrice.data, 18)} />
        <Metric label="Exposure" value={exposure ? `${formatWad(exposure)}×` : '–'} />
        <Metric label="Health" value={health === maxUint256 ? 'No debt' : formatWad(health)} />
        <Metric label="LTV" value={formatBps(position.data?.ltv)} />
        <Metric label="Your shares" value={address ? formatTokenAmount(totalShares, 18) : 'Connect wallet'} />
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button className="flex-1" onClick={onDeposit}>
          Deposit
        </Button>
        {holdings.map(holding => (
          <Button
            key={holding.chainKey}
            className="flex-1"
            variant="outline"
            onClick={() => onWithdraw(holding.chainKey as SourceChainKey, holding.shares)}
          >
            Withdraw from{' '}
            {holding.chainKey === SOURCE_CHAINS[0]
              ? 'Base'
              : holding.chainKey === SOURCE_CHAINS[1]
                ? 'Arbitrum'
                : 'Sonic'}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
