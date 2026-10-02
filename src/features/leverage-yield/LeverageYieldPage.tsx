import type { LeverageYieldVault } from '@sodax/types';
import { useRef, useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositForm } from './components/DepositForm';
import { VaultBrowser } from './components/VaultBrowser';
import { WithdrawDialog } from './components/WithdrawDialog';
import { useVaults } from './hooks/useVaults';

/**
 * Leverage Yield: browse pooled lsoda* ERC-4626 vaults (M3), deposit from any supported network and token
 * (M1/M2), see your shares, and withdraw back to a token on the network you choose (M4).
 */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [withdrawVault, setWithdrawVault] = useState<LeverageYieldVault | null>(null);
  const depositRef = useRef<HTMLDivElement>(null);

  const selectForDeposit = (name: string) => {
    setVaultName(name);
    depositRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-10">
      <NextPrompt next="done" />

      <VaultBrowser vaults={vaults} address={address} onDeposit={selectForDeposit} onWithdraw={setWithdrawVault} />

      <div ref={depositRef} className="scroll-mt-20">
        <DepositForm vaultName={vaultName} onVaultChange={setVaultName} />
      </div>

      {withdrawVault && (
        <WithdrawDialog vault={withdrawVault} address={address} onClose={() => setWithdrawVault(null)} />
      )}
    </div>
  );
}
