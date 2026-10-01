import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositPanel } from './DepositPanel';
import { PositionsList } from './PositionsList';
import { VaultCard } from './VaultCard';
import { useShareHolders, useVaults } from './vaults';
import { WithdrawDialog, type WithdrawTarget } from './WithdrawDialog';

/** Mount point for the Leverage Yield feature: vault browser, deposit, positions and withdraw. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address, connect } = useEvmWallet();
  const holders = useShareHolders(address);
  const [vaultName, setVaultName] = useState(
    () => vaults.find(v => v.name === DEFAULT_VAULT_NAME)?.name ?? vaults[0]?.name ?? '',
  );
  const [withdrawTarget, setWithdrawTarget] = useState<WithdrawTarget>();

  const selectForDeposit = (name: string) => {
    setVaultName(name);
    document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-8">
      <NextPrompt next="done" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-2">
              <h2 className="font-display text-2xl font-bold">Vaults</h2>
              <span className="text-xs text-muted-foreground">Live from Sonic · APR includes staking yield</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {vaults.map(vault => (
                <VaultCard
                  key={vault.name}
                  vault={vault}
                  holders={holders}
                  selected={vault.name === vaultName}
                  onDeposit={() => selectForDeposit(vault.name)}
                />
              ))}
            </div>
          </section>

          <PositionsList vaults={vaults} holders={holders} onWithdraw={setWithdrawTarget} onConnect={connect} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <DepositPanel vaults={vaults} vaultName={vaultName} onVaultChange={setVaultName} />
        </div>
      </div>

      <WithdrawDialog target={withdrawTarget} onClose={() => setWithdrawTarget(undefined)} />
    </div>
  );
}
