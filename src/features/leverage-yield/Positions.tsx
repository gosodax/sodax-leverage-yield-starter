import { WalletIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount } from '@/lib/format';
import { ChainIcon, formatUsd, TokenBadge } from './parts';
import {
  SHARE_DECIMALS,
  shareValue,
  toUsd,
  useShareHoldings,
  useUsdPrice,
  useVaultStats,
  type VaultMeta,
} from './vaults';

/** "Your positions": every vault × network where the connected address holds shares. */
export function Positions({
  vaults,
  address,
  onWithdraw,
}: {
  vaults: VaultMeta[];
  address: string;
  onWithdraw: (meta: VaultMeta, chainKey: SourceChainKey) => void;
}) {
  const [values, setValues] = useState<Record<string, { usd: number; rows: number }>>({});
  const report = useCallback(
    (name: string, usd: number, rows: number) =>
      setValues(v => (Object.is(v[name]?.usd, usd) && v[name]?.rows === rows ? v : { ...v, [name]: { usd, rows } })),
    [],
  );
  const totalUsd = Object.values(values).reduce((sum, v) => sum + v.usd, 0);
  const hasAny = Object.values(values).some(v => v.rows > 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Your positions</h2>
          <p className="text-sm text-muted-foreground">Held in your SODAX hub wallet on Sonic, per source network.</p>
        </div>
        {hasAny && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total value</p>
            <p className="text-2xl font-bold tabular-nums">{formatUsd(totalUsd)}</p>
          </div>
        )}
      </div>
      <Card className="divide-y overflow-hidden">
        {vaults.map(meta => (
          <PositionRows key={meta.vault.name} meta={meta} address={address} onWithdraw={onWithdraw} report={report} />
        ))}
        {!hasAny && (
          <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <WalletIcon className="size-4" />
            No vault shares yet. Pick a vault below to make your first deposit.
          </div>
        )}
      </Card>
    </section>
  );
}

function PositionRows({
  meta,
  address,
  onWithdraw,
  report,
}: {
  meta: VaultMeta;
  address: string;
  onWithdraw: (meta: VaultMeta, chainKey: SourceChainKey) => void;
  report: (name: string, usd: number, rows: number) => void;
}) {
  const holdings = useShareHoldings(meta.vault.vault, address);
  const { pricePerShare } = useVaultStats(meta.vault.vault);
  const price = useUsdPrice()(meta.vault.asset);

  const rows = holdings.rows.map(r => {
    const assets = pricePerShare !== undefined ? shareValue(r.shares, pricePerShare) : undefined;
    return { ...r, assets, usd: toUsd(assets, meta.assetDecimals, price) };
  });
  const usd = rows.reduce((sum, r) => sum + (r.usd ?? 0), 0);

  useEffect(() => report(meta.vault.name, usd, rows.length), [report, meta.vault.name, usd, rows.length]);

  return rows.map(r => (
    <div key={r.chainKey} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <div className="flex min-w-40 flex-1 items-center gap-3">
        <TokenBadge symbol={meta.assetSymbol} />
        <div className="flex flex-col">
          <span className="font-semibold">{meta.shareSymbol}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChainIcon chainKey={r.chainKey as SourceChainKey} className="size-3" />
            via {chainName(r.chainKey)}
          </span>
        </div>
      </div>
      <div className="flex flex-col text-sm tabular-nums">
        <span className="font-semibold">{formatTokenAmount(r.shares, SHARE_DECIMALS)} shares</span>
        <span className="text-xs text-muted-foreground">
          {formatTokenAmount(r.assets, meta.assetDecimals)} {meta.assetSymbol}
        </span>
      </div>
      <span className="w-24 text-right font-semibold tabular-nums">{formatUsd(r.usd)}</span>
      <Button size="sm" variant="outline" onClick={() => onWithdraw(meta, r.chainKey as SourceChainKey)}>
        Withdraw
      </Button>
    </div>
  ));
}
