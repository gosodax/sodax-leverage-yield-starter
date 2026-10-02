import { useSodaxContext } from '@sodax/dapp-kit';
import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { DepositForm } from './DepositForm';
import { PositionCard } from './PositionCard';
import { VaultBrowser } from './VaultBrowser';
import { WithdrawForm } from './WithdrawForm';

export function LeverageYieldPage() {
  const { sodax } = useSodaxContext();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);

  return (
    <div className="flex flex-col gap-8">
      <NextPrompt next="done" />
      <VaultBrowser selected={vaultName} onSelect={setVaultName} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DepositForm vaultName={vaultName} onVaultChange={setVaultName} />
        </div>
        <div className="flex flex-col gap-6">
          <PositionCard vaultName={vaultName} vault={sodax.leverageYield.getVault(vaultName)?.vault} />
          <WithdrawForm vaultName={vaultName} />
        </div>
      </div>
    </div>
  );
}
