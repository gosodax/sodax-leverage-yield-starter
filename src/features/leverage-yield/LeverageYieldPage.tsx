import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositForm } from './components/DepositForm';
import { VaultGrid } from './components/VaultGrid';
import { useVaults } from './hooks/useVaults';

/** Leverage Yield: browse pooled lsoda* ERC-4626 vaults and deposit via SODAX intents. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);

  const selectVault = (name: string) => {
    setVaultName(name);
    document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-10">
      <NextPrompt next="done" />
      <VaultGrid vaults={vaults} address={address} selected={vaultName} onSelect={selectVault} />
      <section id="deposit" className="scroll-mt-20">
        <DepositForm vaultName={vaultName} onVaultChange={setVaultName} />
      </section>
    </div>
  );
}
