import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_SOURCE_CHAIN, DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { VaultPanel } from './components/VaultPanel';
import { VaultTable } from './components/VaultTable';
import { useVaults } from './hooks/useVaultData';

export function LeverageYieldPage() {
  const vaults = useVaults();
  const [selected, setSelected] = useState<string>(
    () => (vaults.find(v => v.name === DEFAULT_VAULT_NAME) ?? vaults[0])?.name,
  );
  const vault = vaults.find(v => v.name === selected);
  // One EOA on every EVM chain; the chain only matters when signing.
  const { address } = useEvmWallet(DEFAULT_SOURCE_CHAIN);

  return (
    <div className="flex flex-col gap-10">
      {/* Workshop helper: local dev only, not on the deployed site. */}
      {import.meta.env.DEV && <NextPrompt next="done" />}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-5xl font-semibold leading-none">
              Vaults<span className="text-accent">.</span>
            </h2>
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              Each vault holds a staking asset, borrows against it and re-stakes to a target LTV. Pick one to deposit.
            </p>
          </div>
          <VaultTable vaults={vaults} selected={selected} onSelect={setSelected} address={address} />
          <p className="text-xs text-subtle-foreground">
            APR is the vault's net rate after borrowing costs: variable, and it can go negative. Health below 1.0 means
            liquidation.
          </p>
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {vault && <VaultPanel key={vault.name} vault={vault} address={address} />}
        </aside>
      </div>
    </div>
  );
}
