import type { LeverageYieldVault } from '@sodax/types';
import { useCallback, useState } from 'react';
import { chainName } from '@/lib/chains';
import { formatBps, formatRayPercent, formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useShares, useVaultStats } from '../hooks/useVaultData';
import { SHARE_DECIMALS, shareValue, underlying, yieldSource } from '../lib/vaults';
import { DepositForm } from './DepositForm';
import { ChainLogo, Label } from './Pickers';
import { WithdrawForm } from './WithdrawForm';

type Tab = 'deposit' | 'withdraw';

export function VaultPanel({ vault, address }: { vault: LeverageYieldVault; address: string | undefined }) {
  const [tab, setTab] = useState<Tab>('deposit');
  const stats = useVaultStats(vault);
  const shares = useShares(vault, address);
  const { symbol, decimals } = underlying(vault);
  const refetch = shares.refetch;
  const onDone = useCallback(() => void refetch(), [refetch]);

  return (
    <section className="flex flex-col gap-5 border-[3px] border-foreground p-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Label>{yieldSource(vault) || 'Vault'}</Label>
          <h2 className="font-display text-4xl font-semibold leading-none">{symbol} vault</h2>
        </div>
        <div className="text-right">
          <Label>Net APR</Label>
          <p className="font-display text-4xl leading-none text-accent tabular-nums">
            {formatRayPercent(stats.aprRay)}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 border-y text-sm">
        <Stat
          label="Share price"
          value={stats.sharePrice === undefined ? '—' : `${formatTokenAmount(stats.sharePrice, decimals)} ${symbol}`}
        />
        <Stat label="LTV" value={stats.ltvBps === undefined ? '—' : formatBps(stats.ltvBps)} />
        <Stat label="Shares" value={vault.name} />
      </dl>

      {/* Your position */}
      <div className="flex flex-col gap-2">
        <Label>Your position</Label>
        {!address ? (
          <p className="text-sm text-muted-foreground">Connect a wallet to see your shares.</p>
        ) : shares.total === 0n ? (
          <p className="text-sm text-muted-foreground">{shares.isLoading ? 'Loading…' : 'No shares yet.'}</p>
        ) : (
          <>
            <p className="font-display text-3xl tabular-nums">
              {formatTokenAmount(shares.total, SHARE_DECIMALS)}{' '}
              <span className="text-base text-muted-foreground">
                shares ≈ {formatTokenAmount(shareValue(shares.total, stats.sharePrice), decimals)} {symbol}
              </span>
            </p>
            <ul className="flex flex-col text-sm">
              {shares.byChain.map(h => (
                <li key={h.chainKey} className="flex items-center justify-between border-b py-1.5">
                  <span className="flex items-center gap-2">
                    <ChainLogo chainKey={h.chainKey} />
                    From {chainName(h.chainKey)}
                  </span>
                  <span className="tabular-nums">{formatTokenAmount(h.shares, SHARE_DECIMALS)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-subtle-foreground">
              Held in your SODAX hub wallet on Sonic, not in your wallet app.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 border-b-[3px] border-foreground" role="tablist">
        {(['deposit', 'withdraw'] as const).map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'py-2.5 font-display text-lg uppercase tracking-wide',
              tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <DepositForm key={vault.name} vault={vault} onDone={onDone} />
      ) : (
        <WithdrawForm
          key={`${vault.name}-${shares.byChain.map(h => h.chainKey).join()}`}
          vault={vault}
          holdings={shares.byChain}
          onDone={onDone}
        />
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-r py-2.5 pr-2 last:border-r-0 [&:not(:first-child)]:pl-3">
      <Label>{label}</Label>
      <span className="truncate font-display text-base tabular-nums">{value}</span>
    </div>
  );
}
