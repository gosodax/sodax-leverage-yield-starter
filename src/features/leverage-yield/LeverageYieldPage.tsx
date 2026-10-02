import { useState } from 'react';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositForm } from './DepositForm';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';
import './motion.css';
import { TickerTape } from './TickerTape';
import { useVaults } from './useVaults';
import { VaultCard } from './VaultCard';
import { WithdrawDialog } from './WithdrawDialog';
import { type Holding, YourPositions } from './YourPositions';

/** Mount point for the Leverage Yield feature: the user's position, the vault browser and the deposit form. */
export function LeverageYieldPage() {
  return (
    <FeatureErrorBoundary>
      <VaultsView />
    </FeatureErrorBoundary>
  );
}

function VaultsView() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [withdrawing, setWithdrawing] = useState<Holding>();

  const selectForDeposit = (name: string) => {
    setVaultName(name);
    document.getElementById('deposit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-8">
      <TickerTape vaults={vaults} />

      {address && <YourPositions vaults={vaults} address={address} onWithdraw={setWithdrawing} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="flex flex-col gap-4" aria-labelledby="vaults-heading">
          <div className="flex flex-col gap-1">
            <h2 id="vaults-heading" className="font-display text-4xl">
              Vaults
            </h2>
            <p className="text-sm text-muted-foreground">
              Each vault holds a liquid staking token on Sonic, borrows against it and re-stakes up to a target LTV.
              That multiplies the staking yield, and the risk. Live on-chain reads.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {vaults.map((info, index) => (
              <VaultCard
                key={info.vault.name}
                info={info}
                index={index}
                address={address}
                selected={info.vault.name === vaultName}
                onDeposit={() => selectForDeposit(info.vault.name)}
              />
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24">
          <DepositForm vaults={vaults} vaultName={vaultName} onVaultChange={setVaultName} />
        </aside>
      </div>

      {withdrawing && <WithdrawDialog holding={withdrawing} onClose={() => setWithdrawing(undefined)} />}
    </div>
  );
}
