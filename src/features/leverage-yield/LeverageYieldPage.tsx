import type { LeverageYieldVault } from '@sodax/types';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_VAULT_NAME, type SourceChainKey } from '@/config/workshop';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { ActivityList } from './components/ActivityList';
import { DepositPanel } from './components/DepositPanel';
import { Portfolio } from './components/Portfolio';
import { Segmented } from './components/Segmented';
import { VaultCard } from './components/VaultCard';
import { type HoldingKey, WithdrawPanel } from './components/WithdrawPanel';
import { type Activity, useActivity } from './hooks/useActivity';
import { useHoldings, useUsdPrices, useVaultStats, useVaults } from './hooks/useVaults';
import { useWalletAssets } from './hooks/useWalletAssets';
import { priceFor, toUsd } from './lib/usd';
import { underlying } from './lib/vaults';

type Sort = 'apr' | 'tvl' | 'health';
type Tab = 'deposit' | 'withdraw';

const SORTS = [
  { value: 'apr', label: 'Top APR' },
  { value: 'tvl', label: 'Largest' },
  { value: 'health', label: 'Safest' },
] as const;

/**
 * Leverage Yield: browse the lsoda* vaults, deposit from any supported network and token, track shares and
 * withdraw. Left: portfolio, vault cards, activity. Right: a sticky action panel (deposit / withdraw).
 */
export function LeverageYieldPage() {
  const { address, isConnected, connect } = useEvmWallet();
  const vaults = useVaults();
  const stats = useVaultStats(vaults);
  const prices = useUsdPrices();
  const holdings = useHoldings(vaults, address);
  const wallet = useWalletAssets(address, prices);
  const activity = useActivity(address);

  const [tab, setTab] = useState<Tab>('deposit');
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [withdrawKey, setWithdrawKey] = useState<HoldingKey>();
  const [sort, setSort] = useState<Sort>('apr');
  const panelRef = useRef<HTMLDivElement>(null);

  const focusPanel = () => {
    // On narrow screens the panel sits below the cards: bring it into view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const deposit = (vault: LeverageYieldVault) => {
    setVaultName(vault.name);
    setTab('deposit');
    focusPanel();
  };
  const withdraw = (vault: LeverageYieldVault, chainKey?: SourceChainKey) => {
    const first = chainKey ?? holdings.holdings.find(h => h.vault.name === vault.name)?.chainKey;
    if (first) setWithdrawKey({ vaultName: vault.name, chainKey: first });
    setTab('withdraw');
    focusPanel();
  };

  const metric = useCallback(
    (vault: LeverageYieldVault, by: Sort): number => {
      const s = stats.get(vault.vault);
      if (by === 'apr') return Number(s?.apr.data?.netAprRay ?? -(10n ** 30n)) / 1e25;
      if (by === 'health') return Number(s?.position.data?.healthFactor ?? 0n) / 1e18;
      const asset = underlying(vault);
      return toUsd(s?.tvl.data, asset.decimals, priceFor(prices, vault.asset)) ?? 0;
    },
    [stats, prices],
  );

  const sorted = useMemo(() => [...vaults].sort((a, b) => metric(b, sort) - metric(a, sort)), [vaults, sort, metric]);
  const leaders = useMemo(() => {
    const top = (by: Sort) => [...vaults].sort((a, b) => metric(b, by) - metric(a, by))[0]?.name;
    const loaded = vaults.every(v => stats.get(v.vault)?.apr.data && stats.get(v.vault)?.position.data);
    return loaded ? { apr: top('apr'), health: top('health') } : {};
  }, [vaults, metric, stats]);

  const logActivity = useCallback(
    (item: Omit<Activity, 'id' | 'at'>) =>
      activity.upsert({
        ...item,
        id: `${(address ?? '').toLowerCase()}:${item.srcTxHash}`,
        at: activity.items.find(a => a.srcTxHash === item.srcTxHash)?.at ?? Date.now(),
      }),
    [activity, address],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Portfolio
            connected={isConnected}
            loading={!holdings.loaded && holdings.isLoading}
            holdings={holdings.holdings}
            stats={stats}
            prices={prices}
            onConnect={connect}
            onWithdraw={withdraw}
          />

          <section aria-labelledby="vaults" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="vaults" className="font-display text-3xl font-bold">
                  Vaults
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pooled ERC-4626 vaults on Sonic. Each loops a staking token to multiply its yield.
                </p>
              </div>
              <Segmented label="Sort vaults" value={sort} options={SORTS} onChange={setSort} size="sm" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sorted.map(vault => {
                const mine = holdings.loaded ? holdings.sharesOf(vault.vault) : undefined;
                return (
                  <VaultCard
                    key={vault.name}
                    vault={vault}
                    stats={stats.get(vault.vault)}
                    prices={prices}
                    myShares={mine}
                    selected={tab === 'deposit' && vault.name === vaultName}
                    highlight={
                      leaders.apr === vault.name ? 'Top APR' : leaders.health === vault.name ? 'Safest' : undefined
                    }
                    onDeposit={() => deposit(vault)}
                    onWithdraw={mine && mine > 0n ? () => withdraw(vault) : undefined}
                  />
                );
              })}
            </div>
          </section>

          <ActivityList items={activity.items} onClear={activity.clear} />
        </div>

        <aside ref={panelRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-xl border bg-card shadow-md">
            <div className="grid grid-cols-2 border-b" role="tablist" aria-label="Action">
              {(['deposit', 'withdraw'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3.5 text-sm font-semibold capitalize transition-colors',
                    tab === t
                      ? 'bg-card text-primary shadow-[inset_0_-2px_0_var(--color-primary)]'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'deposit' ? (
                    <ArrowDownToLineIcon className="size-4" />
                  ) : (
                    <ArrowUpFromLineIcon className="size-4" />
                  )}
                  {t}
                  {t === 'withdraw' && holdings.holdings.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                      {holdings.holdings.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === 'deposit' ? (
                <DepositPanel
                  vaults={vaults}
                  vaultName={vaultName}
                  onVaultChange={setVaultName}
                  stats={stats.get(vaults.find(v => v.name === vaultName)?.vault ?? '0x')}
                  prices={prices}
                  assets={wallet.assets}
                  balanceOf={wallet.balanceOf}
                  onActivity={logActivity}
                />
              ) : (
                <WithdrawPanel
                  holdings={holdings.holdings}
                  loaded={holdings.loaded}
                  selected={withdrawKey}
                  onSelect={setWithdrawKey}
                  statsOf={vault => stats.get(vault.vault)}
                  prices={prices}
                  onActivity={logActivity}
                  onBrowse={() => setTab('deposit')}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
