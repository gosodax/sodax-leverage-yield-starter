import { useState } from 'react';
import { DEFAULT_SOURCE_CHAIN, type SourceChainKey } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { VaultCard } from './components/VaultCard';
import { VaultDialog, type VaultTab } from './components/VaultDialog';
import { useVaults } from './hooks/useVaults';

export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [selected, setSelected] = useState<{ name: string; tab: VaultTab; chain: SourceChainKey; shares?: bigint }>();
  const vault = vaults.find(item => item.name === selected?.name);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Yield strategies</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Choose a vault</h2>
        <p className="max-w-2xl text-muted-foreground">
          Deposit from Base, Arbitrum, or Sonic with a supported asset. Balanced handles the route and delivers your
          vault shares when the order settles.
        </p>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {vaults.map(item => (
          <VaultCard
            key={item.vault}
            vault={item}
            address={address}
            onDeposit={() => setSelected({ name: item.name, tab: 'deposit', chain: DEFAULT_SOURCE_CHAIN })}
            onWithdraw={(chain, shares) => setSelected({ name: item.name, tab: 'withdraw', chain, shares })}
          />
        ))}
      </div>
      <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">Built for flexible entry and exit</h3>
        <p className="mt-2">
          Enter with a supported token on your preferred network, then withdraw your shares to the asset and network you
          choose. Returns are variable, and leveraged strategies can lose value if market conditions change.
        </p>
      </section>
      {vault && selected && (
        <VaultDialog
          vault={vault}
          open
          initialTab={selected.tab}
          heldChain={selected.chain}
          heldShares={selected.shares}
          onOpenChange={open => {
            if (!open) setSelected(undefined);
          }}
        />
      )}
    </div>
  );
}
