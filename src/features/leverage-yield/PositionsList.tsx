import type { LeverageYieldShareHolding } from '@sodax/dapp-kit';
import { type LeverageYieldShareHolder, useLeverageYieldPreviewRedeem } from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { WalletIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isSourceChain } from '@/config/workshop';
import { formatTokenAmount } from '@/lib/format';
import { ChainLabel } from './pickers';
import { useTotalShares } from './VaultCard';
import { underlyingSymbol } from './vaults';
import type { WithdrawTarget } from './WithdrawDialog';

function PositionRow({
  vault,
  row,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  row: LeverageYieldShareHolding;
  onWithdraw: (target: WithdrawTarget) => void;
}) {
  const { data: value } = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: row.shares } });
  const asset = underlyingSymbol(vault.name);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {formatTokenAmount(row.shares, 18)}{' '}
          <span className="font-mono text-xs text-muted-foreground">{vault.name}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {value !== undefined && `≈ ${formatTokenAmount(value, 18)} ${asset} · `}
          deposited from <ChainLabel chainKey={row.chainKey} />
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!isSourceChain(row.chainKey)}
        onClick={() =>
          isSourceChain(row.chainKey) && onWithdraw({ vault, srcChainKey: row.chainKey, shares: row.shares })
        }
      >
        Withdraw
      </Button>
    </div>
  );
}

function VaultPositions({
  vault,
  holders,
  onWithdraw,
  onCount,
}: {
  vault: LeverageYieldVault;
  holders: LeverageYieldShareHolder[];
  onWithdraw: (target: WithdrawTarget) => void;
  onCount: (name: string, count: number | undefined) => void;
}) {
  const { rows, loaded } = useTotalShares(vault, holders);
  useEffect(() => onCount(vault.name, loaded ? rows.length : undefined), [vault.name, loaded, rows.length, onCount]);
  return rows.map(row => (
    <PositionRow key={`${row.chainKey}-${row.holder}`} vault={vault} row={row} onWithdraw={onWithdraw} />
  ));
}

/** "Your positions": every vault × source network the user holds shares under, each withdrawable. */
export function PositionsList({
  vaults,
  holders,
  onWithdraw,
  onConnect,
}: {
  vaults: readonly LeverageYieldVault[];
  holders: LeverageYieldShareHolder[] | undefined;
  onWithdraw: (target: WithdrawTarget) => void;
  onConnect: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const onCount = useCallback(
    (name: string, count: number | undefined) => setCounts(c => (c[name] === count ? c : { ...c, [name]: count })),
    [],
  );
  const allLoaded = vaults.every(v => counts[v.name] !== undefined);
  const total = Object.values(counts).reduce<number>((acc, n) => acc + (n ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your positions</CardTitle>
        <CardDescription>
          Shares sit in your hub wallet on Sonic, one per network you deposited from. Withdraw to any network.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!holders ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <WalletIcon className="size-6" />
            Connect your wallet to see your vault shares.
            <Button size="sm" onClick={onConnect}>
              Connect wallet
            </Button>
          </div>
        ) : (
          <>
            {vaults.map(vault => (
              <VaultPositions
                key={vault.name}
                vault={vault}
                holders={holders}
                onWithdraw={onWithdraw}
                onCount={onCount}
              />
            ))}
            {!allLoaded && total === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
            {allLoaded && total === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No shares yet. Make a deposit to start.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
