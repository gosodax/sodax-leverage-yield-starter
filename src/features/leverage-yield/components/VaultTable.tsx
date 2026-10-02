import type { LeverageYieldVault } from '@sodax/types';
import { ArrowRightIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useShares, useVaultStats } from '../hooks/useVaultData';
import { SHARE_DECIMALS, underlying, yieldSource } from '../lib/vaults';

const HEAD = 'px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground';

export function VaultTable({
  vaults,
  selected,
  onSelect,
  address,
}: {
  vaults: readonly LeverageYieldVault[];
  selected: string | undefined;
  onSelect: (name: string) => void;
  address: string | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b-[3px] border-foreground">
            <th className={cn(HEAD, 'pl-0')}>Vault</th>
            <th className={cn(HEAD, 'text-right')}>Net APR</th>
            <th className={cn(HEAD, 'text-right')}>TVL</th>
            <th className={cn(HEAD, 'text-right')}>Leverage</th>
            <th className={cn(HEAD, 'text-right')}>Health</th>
            <th className={cn(HEAD, 'text-right')}>Your shares</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {vaults.map(vault => (
            <VaultRow
              key={vault.name}
              vault={vault}
              active={vault.name === selected}
              onSelect={() => onSelect(vault.name)}
              address={address}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VaultRow({
  vault,
  active,
  onSelect,
  address,
}: {
  vault: LeverageYieldVault;
  active: boolean;
  onSelect: () => void;
  address: string | undefined;
}) {
  const stats = useVaultStats(vault);
  const shares = useShares(vault, address);
  const { symbol, decimals } = underlying(vault);
  const negative = stats.aprRay !== undefined && stats.aprRay < 0n;

  return (
    <tr
      onClick={onSelect}
      className={cn(
        'cursor-pointer border-b transition-colors hover:bg-secondary',
        active && 'bg-secondary shadow-[inset_4px_0_0_var(--color-accent)]',
      )}
    >
      <td className="py-4 pr-3 pl-0">
        <button type="button" onClick={onSelect} className="flex flex-col items-start text-left pl-3">
          <span className="font-display text-2xl font-semibold leading-none">{symbol}</span>
          <span className="mt-1 text-xs text-muted-foreground">{yieldSource(vault) || vault.name}</span>
        </button>
      </td>
      <td className="px-3 text-right">
        {stats.aprRay === undefined ? (
          <Skeleton className="ml-auto h-7 w-16" />
        ) : (
          <span className={cn('font-display text-3xl tabular-nums', negative ? 'text-destructive' : 'text-accent')}>
            {formatRayPercent(stats.aprRay)}
          </span>
        )}
      </td>
      <td className="px-3 text-right font-display text-lg tabular-nums">
        {stats.tvl === undefined ? '—' : formatTokenAmount(stats.tvl, decimals, 2)}
        <span className="ml-1 text-xs text-muted-foreground">{symbol}</span>
      </td>
      <td className="px-3 text-right font-display text-lg tabular-nums">
        {stats.leverageWad === undefined ? '—' : `${formatWad(stats.leverageWad)}×`}
      </td>
      <td className="px-3 text-right font-display text-lg tabular-nums">
        {stats.healthFactor === undefined ? '—' : formatWad(stats.healthFactor)}
      </td>
      <td className="px-3 text-right tabular-nums">
        {!address ? (
          <span className="text-subtle-foreground">—</span>
        ) : shares.isLoading ? (
          <Skeleton className="ml-auto h-5 w-12" />
        ) : (
          <span className={cn('font-display text-lg', shares.total > 0n ? '' : 'text-subtle-foreground')}>
            {formatTokenAmount(shares.total, SHARE_DECIMALS)}
          </span>
        )}
      </td>
      <td className="pr-1 text-right">
        <ArrowRightIcon className={cn('ml-auto size-4', active ? 'text-accent' : 'text-subtle-foreground')} />
      </td>
    </tr>
  );
}
