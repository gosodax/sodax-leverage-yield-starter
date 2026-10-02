import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/sdk';
import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SOURCE_CHAINS } from '@/config/workshop';
import { formatRayPercent, formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { OVERLINE, SHARE_DECIMALS } from './shared';
import { vaultDescription, vaultUnderlyingSymbol } from './vaults';

function VaultRow({
  vault,
  selected,
  onSelect,
  onDeposit,
}: {
  vault: LeverageYieldVault;
  selected: boolean;
  onSelect: (name: string) => void;
  onDeposit: (name: string) => void;
}) {
  const wallet = useEvmWallet();

  // Same query keys as the spotlight and position card, so React Query dedupes the reads.
  const { data: apr } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const holders = useMemo(
    () =>
      wallet.address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address: wallet.address as string })) : undefined,
    [wallet.address],
  );
  const holdings = useLeverageYieldShareBalances({ params: { vault: vault.vault, holders } });
  const myShares = holdings.reduce((acc, query) => acc + (query.data?.shares ?? 0n), 0n);

  const underlying = vaultUnderlyingSymbol(vault.name);
  const negativeApr = apr !== undefined && apr.effectiveNetAprRay < 0n;

  return (
    <tr
      onClick={() => onSelect(vault.name)}
      className={cn(
        'cursor-pointer border-t border-border transition-colors hover:bg-secondary/50',
        selected && 'bg-notice/60 shadow-[inset_2px_0_0_var(--primary)]',
      )}
    >
      <td className="px-3 py-3.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-display text-sm font-bold">{vault.name}</span>
          <Badge className="hidden sm:inline-flex">{underlying}</Badge>
        </div>
        <p className="mt-0.5 hidden max-w-48 truncate text-xs text-muted-foreground lg:block">
          {vaultDescription(vault.name)}
        </p>
      </td>
      <td className="px-3 py-3.5 text-right sm:px-4">
        {apr === undefined ? (
          <Skeleton className="ml-auto h-5 w-14" />
        ) : (
          <span className={cn('font-mono text-sm font-semibold', negativeApr ? 'text-destructive' : 'text-success')}>
            {formatRayPercent(apr.effectiveNetAprRay)}
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3.5 text-right sm:table-cell sm:px-4">
        {tvl === undefined ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          <span className="whitespace-nowrap font-mono text-sm">
            {formatTokenAmount(tvl, 18, 2)} <span className="text-muted-foreground">{underlying}</span>
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3.5 text-right sm:px-4 md:table-cell">
        <span className="font-mono text-sm">
          {wallet.isConnected ? formatTokenAmount(myShares, SHARE_DECIMALS) : '–'}
        </span>
      </td>
      <td className="px-3 py-3.5 text-right sm:px-4">
        <Button
          size="sm"
          variant={selected ? 'default' : 'outline'}
          onClick={event => {
            event.stopPropagation();
            onDeposit(vault.name);
          }}
        >
          Deposit
          <ArrowUpRight className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}

/** Markets table: one dense row per vault. Clicking a row selects it; Deposit also jumps to the form. */
export function VaultTable({
  vaults,
  selectedVaultName,
  onSelect,
  onDeposit,
}: {
  vaults: LeverageYieldVault[];
  selectedVaultName: string;
  onSelect: (name: string) => void;
  onDeposit: (name: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={cn(OVERLINE, 'whitespace-nowrap px-3 pb-2 pt-4 text-left sm:px-4')}>Vault</th>
              <th className={cn(OVERLINE, 'whitespace-nowrap px-3 pb-2 pt-4 text-right sm:px-4')}>Net APR</th>
              <th className={cn(OVERLINE, 'hidden whitespace-nowrap px-3 pb-2 pt-4 text-right sm:table-cell sm:px-4')}>
                TVL
              </th>
              <th className={cn(OVERLINE, 'hidden whitespace-nowrap px-3 pb-2 pt-4 text-right sm:px-4 md:table-cell')}>
                Your shares
              </th>
              <th className="px-3 pb-2 pt-4 sm:px-4" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {vaults.map(vault => (
              <VaultRow
                key={vault.name}
                vault={vault}
                selected={vault.name === selectedVaultName}
                onSelect={onSelect}
                onDeposit={onDeposit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
