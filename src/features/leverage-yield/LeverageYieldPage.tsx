import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
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
      <NextPrompt next="done" />
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-3xl font-bold">Choose a vault</h2>
        <p className="max-w-2xl text-muted-foreground">
          Deposit a supported token from Base, Arbitrum, or Sonic. Your wallet signs an intent; independent solvers
          deliver pooled vault shares to your SODAX hub wallet.
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
        <h3 className="font-semibold text-foreground">How it works</h3>
        <p className="mt-2">
          Vaults are leveraged ERC-4626 strategies on Sonic. APR is variable, may become negative, and share value can
          fall. A withdrawal is the only exit; submitted orders can take time to route and settle.
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
