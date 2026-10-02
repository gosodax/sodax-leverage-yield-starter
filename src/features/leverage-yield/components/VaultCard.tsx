import { InfoIcon } from '@phosphor-icons/react';
import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldShareBalances,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { AnimatePresence, m } from 'motion/react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { ThinkingOrb } from '@/components/ui/thinking-orb';
import { Tooltip } from '@/components/ui/tooltip';
import { SOURCE_CHAINS } from '@/config/workshop';
import { formatBps, formatRayPercent, formatTokenAmount, formatWad } from '@/lib/format';
import { useSharePrice } from '../hooks/useShareValue';
import { vaultBrand } from '../lib/brands';
import { SHARE_DECIMALS, underlying } from '../lib/vaults';
import { VaultIcon } from './VaultIcon';

/**
 * One vault, readable at a glance: icon, friendly name and ticker, the variable APR, how much it holds. Share price,
 * leverage and health sit behind "Details" for the risk-aware reader. The user's shares show when connected.
 */
export function VaultCard({
  vault,
  address,
  selected,
  onDeposit,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  selected?: boolean;
  onDeposit: () => void;
}) {
  const { data: apr, isError: aprError } = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const sharePrice = useSharePrice(vault.vault);
  const { data: position } = useLeverageYieldPosition({ params: { vault: vault.vault } });

  // Deposits from each chain land in a different hub wallet, so sum across all source chains.
  const balances = useLeverageYieldShareBalances({
    params: {
      vault: vault.vault,
      holders: address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined,
    },
  });
  const myShares = balances.reduce((sum, query) => sum + (query.data?.shares ?? 0n), 0n);
  const brand = vaultBrand(vault);
  const { decimals } = underlying(vault);

  return (
    <Card className="relative flex w-full flex-col transition-shadow duration-200 ease-out hover:shadow-lg">
      {/* Selected border fades in when this vault becomes the deposit target. */}
      <AnimatePresence initial={false}>
        {selected && (
          <m.span
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-lg ring-2 ring-primary"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          />
        )}
      </AnimatePresence>

      <CardHeader className="gap-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <VaultIcon vault={vault} />
          {apr?.lsdApr.stale && <Badge variant="muted">APR estimate</Badge>}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{brand.name}</CardTitle>
            <Badge variant="muted">{brand.ticker}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{brand.tagline}</p>
        </div>
        <div>
          {apr ? (
            <p className="text-4xl font-semibold text-foreground">{formatRayPercent(apr.effectiveNetAprRay)}</p>
          ) : aprError ? (
            <p className="text-4xl font-semibold text-subtle-foreground">-</p>
          ) : (
            <ThinkingOrb state="breathing" size={32} label="Loading APR" />
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            Net APR, variable
            <Tooltip content="Staking yield of the underlying asset plus the lending spread, multiplied by the vault's leverage. Variable; can turn negative.">
              <InfoIcon weight="duotone" className="size-3.5" />
            </Tooltip>
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm">
          {tvl !== undefined ? (
            <>
              Holds <span className="font-medium">{formatTokenAmount(tvl, decimals, 2)}</span> {brand.ticker} so far
            </>
          ) : (
            <ThinkingOrb state="breathing" size={20} label="Loading vault size" />
          )}
        </p>
        {address && (
          <p className="text-sm text-muted-foreground">
            You hold <span className="font-medium text-foreground">{formatTokenAmount(myShares, SHARE_DECIMALS)}</span>{' '}
            shares
          </p>
        )}

        <div className="mt-auto">
          <Disclosure>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Stat
                label="Share price"
                value={sharePrice !== undefined && `${formatTokenAmount(sharePrice, decimals)} ${brand.ticker}`}
              />
              <Stat label="Leverage" value={apr && `${formatWad(apr.leverageMultiplierWad)}×`} />
              <Stat
                label="Health / LTV"
                value={position && `${formatWad(position.healthFactor)} / ${formatBps(position.ltv)}`}
                className="col-span-2"
              />
            </dl>
          </Disclosure>
        </div>
      </CardContent>

      <CardFooter>
        <Button className="w-full" variant={selected ? 'default' : 'outline'} onClick={onDeposit}>
          {selected ? 'Selected' : 'Deposit'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">
        {value || <ThinkingOrb state="breathing" size={20} className="mt-1" label="Loading" />}
      </dd>
    </div>
  );
}
