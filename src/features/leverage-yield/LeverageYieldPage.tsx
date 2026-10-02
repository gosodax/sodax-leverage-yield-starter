import { useState } from 'react';
import type { SourceChainKey } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { TransportProvider, TransportToggle } from './api/transport';
import { useUsdPrices, useVaultStats } from './api/useTransportReads';
import { HowItWorks } from './components/HowItWorks';
import { VaultDialog, type VaultTab } from './components/VaultDialog';
import { VaultList } from './components/VaultList';
import { YourVaults } from './components/YourVaults';
import { useVaults } from './hooks/useVaults';

/**
 * Leverage Yield: browse pooled lsoda* ERC-4626 vaults, deposit and withdraw via SODAX intents.
 * The SDK/API toggle switches every read, quote and transaction between @sodax/sdk and the REST API.
 */
export function LeverageYieldPage() {
  return (
    <TransportProvider>
      <LeverageYieldContent />
    </TransportProvider>
  );
}

function LeverageYieldContent() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  // One read of every vault, shared by the list, "Your vaults" and the dialog.
  const stats = useVaultStats(vaults, address);
  const prices = useUsdPrices();
  const [open, setOpen] = useState<{ vaultName: string; tab: VaultTab; heldUnder?: SourceChainKey } | null>(null);

  const openVault = open && vaults.find(vault => vault.name === open.vaultName);
  const openStats = openVault && stats.get(openVault.vault);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-3xl font-bold">Vaults</h2>
          <p className="text-muted-foreground">
            Deposit USDC, ETH and more from Base, Arbitrum or Sonic. Solvers turn it into vault shares in one order.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Data source <TransportToggle />
        </div>
      </div>

      {address && (
        <YourVaults
          vaults={vaults}
          stats={stats}
          prices={prices}
          onWithdraw={(vaultName, heldUnder) => setOpen({ vaultName, tab: 'withdraw', heldUnder })}
        />
      )}
      <VaultList
        vaults={vaults}
        stats={stats}
        prices={prices}
        connected={!!address}
        onOpen={vaultName => setOpen({ vaultName, tab: 'deposit' })}
      />
      <HowItWorks />

      {open && openVault && openStats && (
        <VaultDialog
          vault={openVault}
          stats={openStats}
          prices={prices}
          initialTab={open.tab}
          heldUnder={open.heldUnder}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
