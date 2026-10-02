import type { LeverageYieldVault } from '@sodax/types';
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  ExternalLinkIcon,
  SparklesIcon,
  TrendingDownIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { explorerAddressUrl } from '@/lib/chains';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Read, VaultStats } from '../hooks/useVaults';
import { formatCompactUsd, formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { formatShares, healthTone, isInfiniteHealth, shareValue, underlying, vaultTagline } from '../lib/vaults';
import { TokenIcon } from './TokenIcon';

function Stat<T>({
  label,
  read,
  hint,
  children,
}: {
  label: string;
  read: Read<T>;
  hint: string;
  children: (data: T) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip content={hint}>
        <span className="w-fit cursor-help text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
          {label}
        </span>
      </Tooltip>
      <span className="font-mono text-sm font-semibold">
        {read.data !== undefined ? children(read.data) : read.isLoading ? <Skeleton className="h-5 w-16" /> : '–'}
      </span>
    </div>
  );
}

const TONE_DOT = { success: 'bg-success', notice: 'bg-accent', destructive: 'bg-destructive' } as const;

export function VaultCard({
  vault,
  stats,
  prices,
  myShares,
  highlight,
  selected,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  stats: VaultStats | undefined;
  prices: UsdPrices;
  myShares: bigint | undefined;
  highlight?: string;
  selected?: boolean;
  onDeposit: () => void;
  onWithdraw?: () => void;
}) {
  const asset = underlying(vault);
  const assetPrice = priceFor(prices, vault.asset);
  const apr = stats?.apr.data;
  const negative = apr !== undefined && apr.netAprRay < 0n;
  const myValue = shareValue(myShares, stats?.sharePrice.data);
  const myUsd = toUsd(myValue, asset.decimals, assetPrice);
  const empty: Read<never> = { data: undefined, isLoading: true, isError: false };

  return (
    <article
      className={cn(
        'group relative flex min-w-0 flex-col gap-5 rounded-lg border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        selected && 'ring-2 ring-primary',
      )}
    >
      <header className="flex items-start gap-3">
        <TokenIcon symbol={asset.symbol} className="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-bold leading-tight">{asset.symbol} Vault</h3>
            {highlight && (
              <Badge variant="success">
                <SparklesIcon className="size-3" />
                {highlight}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{vaultTagline(vault)}</p>
        </div>
        <a
          href={explorerAddressUrl('sonic', vault.vault)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${vault.name} contract on Sonicscan`}
          className="rounded-full p-1.5 text-subtle-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          <ExternalLinkIcon className="size-4" />
        </a>
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net APR</p>
          {apr ? (
            <p className={cn('font-display text-4xl font-bold', negative ? 'text-destructive' : 'text-primary')}>
              {formatRayPercent(apr.netAprRay)}
            </p>
          ) : stats?.apr.isError ? (
            <p className="font-display text-4xl font-bold text-subtle-foreground">–</p>
          ) : (
            <Skeleton className="mt-1 h-10 w-28" />
          )}
          {apr && (
            <p className="text-xs text-muted-foreground">
              {apr.lsdLabel}
              {apr.stale && ' · estimate'}
            </p>
          )}
        </div>
        {negative && (
          <Badge variant="destructive">
            <TrendingDownIcon className="size-3" /> Negative carry
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-muted/60 p-3">
        <Stat label="TVL" read={stats?.tvl ?? empty} hint={`Total assets in the vault, in ${asset.symbol}.`}>
          {tvl =>
            formatCompactUsd(toUsd(tvl, asset.decimals, assetPrice)) ||
            `${formatTokenAmount(tvl, asset.decimals, 2)} ${asset.symbol}`
          }
        </Stat>
        <Stat
          label="Share price"
          read={stats?.sharePrice ?? empty}
          hint={`${asset.symbol} redeemable per 1 ${vault.name} share. Rises as yield accrues; can fall.`}
        >
          {price => formatTokenAmount(price, asset.decimals, 4)}
        </Stat>
        <Stat
          label="Leverage"
          read={stats?.apr ?? empty}
          hint="Yield multiplier from looping at the vault's target LTV: LTV / (1 − LTV)."
        >
          {a => `${formatWad(a.leverageWad, 2)}×`}
        </Stat>
        <Stat
          label="Health"
          read={stats?.position ?? empty}
          hint="AAVE health factor of the vault's position. Below 1.00 it can be liquidated. These vaults target ~1.2."
        >
          {p => {
            const tone = healthTone(p.healthFactor);
            return (
              <span className="flex flex-col">
                <span className="inline-flex items-center gap-1.5">
                  {tone && <span className={cn('size-2 rounded-full', TONE_DOT[tone])} />}
                  {isInfiniteHealth(p.healthFactor) ? '∞' : formatWad(p.healthFactor, 2)}
                </span>
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  LTV {formatBps(p.ltv, 1)}
                  {p.targetLtvBps !== undefined && ` · target ${formatBps(p.targetLtvBps, 1)}`}
                </span>
              </span>
            );
          }}
        </Stat>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-3">
        {myShares !== undefined && myShares > 0n ? (
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Your position</p>
            <p className="truncate text-sm font-semibold">
              {formatUsd(myUsd) || `${formatTokenAmount(myValue, asset.decimals)} ${asset.symbol}`}{' '}
              <span className="font-normal text-muted-foreground">· {formatShares(myShares)}</span>
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {onWithdraw && (
          <Button variant="outline" size="sm" onClick={onWithdraw}>
            <ArrowUpFromLineIcon />
            Withdraw
          </Button>
        )}
        <Button size="sm" onClick={onDeposit}>
          <ArrowDownToLineIcon />
          Deposit
        </Button>
      </footer>
    </article>
  );
}
