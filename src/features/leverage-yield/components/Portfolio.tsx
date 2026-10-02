import type { Address, LeverageYieldVault } from '@sodax/types';
import { ArrowUpFromLineIcon, WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatRayPercent } from '@/lib/format';
import type { Holding, VaultStats } from '../hooks/useVaults';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { aprFraction, formatShares, shareValue, underlying } from '../lib/vaults';
import { TokenIcon } from './TokenIcon';

type Line = { holding: Holding; usd: number | undefined; aprRay: bigint | undefined };

function lineFor(holding: Holding, stats: VaultStats | undefined, prices: UsdPrices): Line {
  const asset = underlying(holding.vault);
  const value = shareValue(holding.shares, stats?.sharePrice.data);
  return {
    holding,
    usd: toUsd(value, asset.decimals, priceFor(prices, holding.vault.asset)),
    aprRay: stats?.apr.data?.netAprRay,
  };
}

/**
 * The user's book: total value, blended APR and projected monthly yield across every vault and network, plus a
 * row per (vault, network) with a one-click withdraw. Shares live in the SODAX hub wallet, never in the EOA.
 */
export function Portfolio({
  connected,
  loading,
  holdings,
  stats,
  prices,
  onConnect,
  onWithdraw,
}: {
  connected: boolean;
  loading: boolean;
  holdings: Holding[];
  stats: Map<Address, VaultStats>;
  prices: UsdPrices;
  onConnect: () => void;
  onWithdraw: (vault: LeverageYieldVault, chainKey: SourceChainKey) => void;
}) {
  if (!connected) {
    return (
      <section className="flex flex-col items-start justify-between gap-4 rounded-lg border border-dashed bg-card p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">See your positions and personalised suggestions</p>
          <p className="text-sm text-muted-foreground">
            Connect an EVM wallet. We'll find the tokens you can deposit across Base, Arbitrum and Sonic.
          </p>
        </div>
        <Button onClick={onConnect}>
          <WalletIcon />
          Connect wallet
        </Button>
      </section>
    );
  }

  const lines = holdings.map(h => lineFor(h, stats.get(h.vault.vault), prices));
  const complete = lines.every(l => l.usd !== undefined && l.aprRay !== undefined);
  const total = complete ? lines.reduce((s, l) => s + (l.usd ?? 0), 0) : undefined;
  const yearly = complete ? lines.reduce((s, l) => s + (l.usd ?? 0) * (aprFraction(l.aprRay) ?? 0), 0) : undefined;
  const blended = total && yearly !== undefined ? yearly / total : undefined;

  return (
    <section aria-label="Your portfolio" className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="grid grid-cols-2 gap-4 bg-hero p-5 text-hero-foreground sm:grid-cols-4">
        <Metric label="Total value" value={loading ? undefined : formatUsd(total ?? 0) || '–'} />
        <Metric
          label="Blended APR"
          value={loading ? undefined : blended !== undefined ? `${(blended * 100).toFixed(2)}%` : '–'}
        />
        <Metric label="Est. per month" value={loading ? undefined : formatUsd((yearly ?? 0) / 12) || '–'} />
        <Metric label="Positions" value={loading ? undefined : String(lines.length)} />
      </div>
      {!loading && lines.length === 0 && (
        <p className="p-5 text-sm text-muted-foreground">
          No vault shares yet. Pick a vault below — the deposit panel suggests the best token to fund it with.
        </p>
      )}
      {lines.length > 0 && (
        <ul className="divide-y">
          {lines.map(({ holding, usd, aprRay }) => {
            const asset = underlying(holding.vault);
            return (
              <li key={`${holding.vault.name}-${holding.chainKey}`} className="flex items-center gap-3 px-5 py-3">
                <TokenIcon symbol={asset.symbol} chainKey={holding.chainKey} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {asset.symbol} Vault{' '}
                    <span className="font-normal text-muted-foreground">via {chainName(holding.chainKey)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatShares(holding.shares)}
                    {aprRay !== undefined && ` · ${formatRayPercent(aprRay)} APR`}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold">{formatUsd(usd)}</span>
                <Button variant="ghost" size="sm" onClick={() => onWithdraw(holding.vault, holding.chainKey)}>
                  <ArrowUpFromLineIcon />
                  <span className="hidden sm:inline">Withdraw</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-hero-muted">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-1 h-7 w-20 bg-hero-muted/30" />
      ) : (
        <p className="font-display text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}
