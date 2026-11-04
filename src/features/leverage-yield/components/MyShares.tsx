import type { LeverageYieldVault } from '@sodax/types';
import { useEffect } from 'react';
import type { SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { formatRayPercent, formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useVaultData } from '../hooks/useVaultData';
import { formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import { flavorOf, SHARE_DECIMALS, shareValue, underlying } from '../lib/vaults';
import { Btn } from '../win/controls';
import { BottleIcon } from '../win/icons';

export type ShareRowKey = { vaultName: string; chainKey: SourceChainKey };

export type ShareSummary = { rows: number; usd: number; loaded: boolean };

/**
 * Explorer-style details view of every position: one row per vault and source network (each network has its own
 * hub wallet, so that's where a withdrawal is signed). Double-click or Enter opens the withdraw wizard.
 */
export function MyShares({
  vaults,
  address,
  prices,
  selected,
  onSelect,
  onWithdraw,
  onDeposit,
  onConnect,
  summaries,
  onSummary,
}: {
  vaults: readonly LeverageYieldVault[];
  address: string | undefined;
  prices: UsdPrices;
  selected: ShareRowKey | undefined;
  onSelect: (key: ShareRowKey) => void;
  onWithdraw: (key: ShareRowKey) => void;
  onDeposit: () => void;
  onConnect: () => void;
  summaries: Record<string, ShareSummary>;
  onSummary: (vaultName: string, summary: ShareSummary) => void;
}) {
  const all = vaults.map(v => summaries[v.name]);
  const loaded = !!address && all.every(s => s?.loaded);
  const count = all.reduce((n, s) => n + (s?.rows ?? 0), 0);
  const total = all.reduce((n, s) => n + (s?.usd ?? 0), 0);

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-3 bg-[var(--win-window)] p-6 text-center">
        <p>Connect your wallet to see the shares you hold in each vault.</p>
        <Btn isDefault onClick={onConnect}>
          Connect wallet…
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="w2k-listview max-h-72 min-h-[140px]">
        <table>
          <thead>
            <tr>
              <th>Vault</th>
              <th>From network</th>
              <th className="text-right">Shares</th>
              <th className="text-right">Worth</th>
              <th className="text-right">Value (USD)</th>
              <th className="text-right">Net APR</th>
            </tr>
          </thead>
          <tbody>
            {vaults.map(vault => (
              <VaultRows
                key={vault.vault}
                vault={vault}
                address={address}
                prices={prices}
                selected={selected}
                onSelect={onSelect}
                onWithdraw={onWithdraw}
                onSummary={onSummary}
              />
            ))}
          </tbody>
        </table>
        {loaded && count === 0 && (
          <div className="flex flex-col items-center gap-2 p-5 text-center text-[var(--win-dark)]">
            <p>This folder is empty. Pick a soda in the Vault Dispenser and deposit to get shares.</p>
            <Btn onClick={onDeposit}>Deposit…</Btn>
          </div>
        )}
        {!loaded && <p className="p-3 text-[var(--win-gray-text)]">Reading your hub wallets on Sonic…</p>}
      </div>
      <div className="w2k-statusbar">
        <span className="flex-1">{loaded ? `${count} object(s)` : 'Loading…'}</span>
        <span className="w-40 text-right">{loaded ? `Total ${formatUsd(total) || '–'}` : ''}</span>
      </div>
    </div>
  );
}

function VaultRows({
  vault,
  address,
  prices,
  selected,
  onSelect,
  onWithdraw,
  onSummary,
}: {
  vault: LeverageYieldVault;
  address: string;
  prices: UsdPrices;
  selected: ShareRowKey | undefined;
  onSelect: (key: ShareRowKey) => void;
  onWithdraw: (key: ShareRowKey) => void;
  onSummary: (vaultName: string, summary: ShareSummary) => void;
}) {
  const { apr, sharePrice, holdings, holdingsLoaded } = useVaultData(vault, address);
  const asset = underlying(vault);
  const price = priceFor(prices, vault.asset);
  const rows = holdings.filter(h => h.shares > 0n);
  const usd = rows.reduce(
    (sum, h) => sum + (toUsd(shareValue(h.shares, sharePrice.data), asset.decimals, price) ?? 0),
    0,
  );

  useEffect(() => {
    onSummary(vault.name, { rows: rows.length, usd, loaded: holdingsLoaded });
  }, [vault.name, rows.length, usd, holdingsLoaded, onSummary]);

  return (
    <>
      {rows.map(h => {
        const key = { vaultName: vault.name, chainKey: h.chainKey };
        const isSelected = selected?.vaultName === vault.name && selected.chainKey === h.chainKey;
        const worth = shareValue(h.shares, sharePrice.data);
        return (
          <tr
            key={h.chainKey}
            tabIndex={0}
            aria-selected={isSelected}
            className="cursor-default"
            onClick={() => onSelect(key)}
            onDoubleClick={() => onWithdraw(key)}
            onKeyDown={event => {
              if (event.key === 'Enter') onWithdraw(key);
              if (event.key === ' ') {
                event.preventDefault();
                onSelect(key);
              }
            }}
          >
            <td>
              <span className="inline-flex items-center gap-1.5">
                <BottleIcon color={flavorOf(vault).color} />
                {vault.name}
              </span>
            </td>
            <td>
              <span className="inline-flex items-center gap-1.5">
                <img src={chainLogo(h.chainKey)} alt="" className="size-4" />
                {chainName(h.chainKey)}
              </span>
            </td>
            <td className="text-right">{formatTokenAmount(h.shares, SHARE_DECIMALS, 6)}</td>
            <td className="text-right">
              {formatTokenAmount(worth, asset.decimals, 6)} {asset.symbol}
            </td>
            <td className="text-right">{formatUsd(toUsd(worth, asset.decimals, price)) || '–'}</td>
            <td
              className={cn('text-right', apr.data && apr.data.effectiveNetAprRay < 0n && 'text-[var(--destructive)]')}
            >
              {formatRayPercent(apr.data?.effectiveNetAprRay)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
