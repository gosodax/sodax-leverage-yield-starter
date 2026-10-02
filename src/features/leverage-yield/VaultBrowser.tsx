import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatUnits, maxUint256 } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { useVaultShares } from './shares';
import { formatUsd, type VaultInfo } from './vaults';

const WAD = 10n ** 18n;

function Stat({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <InfoIcon className="size-3 cursor-help" />
          </Tooltip>
        )}
      </dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}

const Loading = () => <Skeleton className="h-5 w-16" />;

function VaultCard({
  vault,
  usdPrice,
  selected,
  onDeposit,
}: {
  vault: VaultInfo;
  usdPrice: number | undefined;
  selected: boolean;
  onDeposit: () => void;
}) {
  const { address } = useEvmWallet();
  const { data: apr, isLoading: aprLoading } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const { data: position } = useLeverageYieldPosition({ params: { vault: vault.vault } });
  const { data: pricePerShare } = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const { total: shares } = useVaultShares(vault.vault, address);

  const toUsd = (amount: bigint | undefined) =>
    amount !== undefined && usdPrice !== undefined
      ? Number(formatUnits(amount, vault.assetDecimals)) * usdPrice
      : undefined;
  const sharesAssets = pricePerShare !== undefined ? (shares * pricePerShare) / WAD : undefined;
  const negative = apr ? apr.effectiveNetAprRay < 0n : false;
  const health = position?.healthFactor;

  return (
    <Card className={cn('flex flex-col transition-shadow', selected && 'ring-2 ring-primary')}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{vault.shareSymbol}</CardTitle>
          <p className="text-sm text-muted-foreground">Leveraged {vault.assetSymbol} staking</p>
        </div>
        <div className="text-right">
          <div className={cn('text-2xl font-bold', negative ? 'text-destructive' : 'text-success')}>
            {aprLoading ? <Loading /> : formatRayPercent(apr?.effectiveNetAprRay)}
          </div>
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Variable APR
            {apr?.lsdApr.stale && <Badge variant="muted">est.</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="TVL">
            {tvl === undefined ? (
              <Loading />
            ) : (
              <>
                {formatTokenAmount(tvl, vault.assetDecimals, 2)} {vault.assetSymbol}
                <span className="block text-xs font-normal text-muted-foreground">{formatUsd(toUsd(tvl))}</span>
              </>
            )}
          </Stat>
          <Stat label="Share price" hint={`${vault.assetSymbol} redeemable for one ${vault.shareSymbol}.`}>
            {pricePerShare === undefined ? <Loading /> : `${formatTokenAmount(pricePerShare, vault.assetDecimals)}`}
          </Stat>
          <Stat
            label="Exposure"
            hint="Total exposure per unit deposited: 1 + the borrowed multiple. Leverage multiplies both yield and risk."
          >
            {apr ? `${formatWad(WAD + apr.leverageMultiplierWad)}×` : <Loading />}
          </Stat>
          <Stat label="Target LTV">{apr ? formatBps(apr.targetLtvBps) : <Loading />}</Stat>
          <Stat label="Current LTV">{position ? formatBps(position.ltv) : <Loading />}</Stat>
          <Stat label="Health" hint="The vault's health factor. Below 1.0 the position can be liquidated.">
            {health === undefined ? <Loading /> : health === maxUint256 ? 'No debt' : formatWad(health)}
          </Stat>
        </dl>
        {address && shares > 0n && (
          <div className="rounded-md bg-secondary px-3 py-2 text-sm">
            <span className="text-muted-foreground">Your shares: </span>
            <span className="font-semibold">{formatTokenAmount(shares, 18)}</span>
            {sharesAssets !== undefined && (
              <span className="text-muted-foreground">
                {' '}
                ≈ {formatTokenAmount(sharesAssets, vault.assetDecimals)} {vault.assetSymbol} (
                {formatUsd(toUsd(sharesAssets))})
              </span>
            )}
          </div>
        )}
        <Button className="mt-auto" variant={selected ? 'default' : 'outline'} onClick={onDeposit}>
          Deposit
        </Button>
      </CardContent>
    </Card>
  );
}

export function VaultBrowser({
  vaults,
  selected,
  onSelect,
  usdPrice,
}: {
  vaults: VaultInfo[];
  selected: string;
  onSelect: (name: string) => void;
  usdPrice: (asset: string) => number | undefined;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold">Vaults</h2>
        <p className="text-sm text-muted-foreground">
          Pooled ERC-4626 vaults on Sonic. Each holds a liquid staking token, borrows against it and re-stakes up to a
          target LTV. APRs are variable estimates at today's rates.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {vaults.map(vault => (
          <VaultCard
            key={vault.name}
            vault={vault}
            usdPrice={usdPrice(vault.asset)}
            selected={vault.name === selected}
            onDeposit={() => onSelect(vault.name)}
          />
        ))}
      </div>
    </section>
  );
}
