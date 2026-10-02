import type { LeverageYieldVault } from '@sodax/types';
import { VaultCard } from './VaultCard';

/** M3: browse every vault as a card. Deposit selects it in the form below; Withdraw opens the withdraw flow. */
export function VaultBrowser({
  vaults,
  address,
  onDeposit,
  onWithdraw,
}: {
  vaults: readonly LeverageYieldVault[];
  address: string | undefined;
  onDeposit: (vaultName: string) => void;
  onWithdraw: (vault: LeverageYieldVault) => void;
}) {
  return (
    <section aria-labelledby="all-vaults" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="all-vaults" className="font-display text-2xl font-bold">
            Vaults
          </h2>
          <p className="text-muted-foreground">
            Deposit from Base, Arbitrum or Sonic. Solvers turn it into vault shares in one order.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {vaults.length} vault{vaults.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {vaults.map(vault => (
          <VaultCard
            key={vault.vault}
            vault={vault}
            address={address}
            onDeposit={() => onDeposit(vault.name)}
            onWithdraw={() => onWithdraw(vault)}
          />
        ))}
      </div>
    </section>
  );
}
