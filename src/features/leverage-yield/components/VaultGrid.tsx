import type { LeverageYieldVault } from '@sodax/types';
import { VaultCard } from './VaultCard';

export function VaultGrid({
  vaults,
  address,
  selected,
  onSelect,
}: {
  vaults: readonly LeverageYieldVault[];
  address: string | undefined;
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold">Vaults</h2>
        <p className="text-sm text-muted-foreground">
          Each vault holds a liquid staking token, borrows against it and re-stakes, earning a levered staking yield.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vaults.map(vault => (
          <VaultCard
            key={vault.name}
            vault={vault}
            address={address}
            selected={vault.name === selected}
            onDeposit={() => onSelect(vault.name)}
          />
        ))}
      </div>
    </section>
  );
}
