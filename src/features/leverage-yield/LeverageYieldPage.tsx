import { useState } from 'react';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositForm } from './components/DepositForm';
import { StartSlot } from './components/StartSlot';
import { VaultGrid } from './components/VaultGrid';
import { useHoldings } from './hooks/useHoldings';
import { useVaults } from './hooks/useVaults';

/** Leverage Yield: browse pooled lsoda* ERC-4626 vaults and deposit via SODAX intents. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [vaultPicked, setVaultPicked] = useState(false);
  const [amountEntered, setAmountEntered] = useState(false);
  const { holdings, loaded } = useHoldings(vaults, address);

  const pickVault = (name: string) => {
    setVaultName(name);
    setVaultPicked(true);
  };

  const scrollToDeposit = (focusAmount = false) => {
    document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focusAmount) document.getElementById('deposit-amount')?.focus({ preventScroll: true });
  };

  const selectVault = (name: string) => {
    pickVault(name);
    scrollToDeposit();
  };

  return (
    <div className="flex flex-col gap-16">
      <StartSlot
        holdings={holdings}
        loaded={loaded}
        vaultPicked={vaultPicked}
        amountEntered={amountEntered}
        onStart={() => scrollToDeposit(true)}
        onAddMore={vault => {
          pickVault(vault.name);
          scrollToDeposit(true);
        }}
      />
      <VaultGrid vaults={vaults} address={address} selected={vaultName} onSelect={selectVault} />
      <section id="deposit" className="scroll-mt-20">
        <DepositForm vaultName={vaultName} onVaultChange={pickVault} onAmountChange={setAmountEntered} />
      </section>
    </div>
  );
}
