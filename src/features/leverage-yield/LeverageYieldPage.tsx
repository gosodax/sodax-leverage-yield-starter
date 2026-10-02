import { useState } from 'react';
import { Callout } from '@/components/ui/callout';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { DepositCard } from './DepositCard';
import { VaultBrowser } from './VaultBrowser';
import { useAssetUsdPrices, useVaults } from './vaults';
import { WithdrawCard } from './WithdrawCard';

/** SODAX Leverage Yield: browse the vaults, deposit from any supported network and token, hold and withdraw. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const usdPrice = useAssetUsdPrices();
  const [selected, setSelected] = useState(
    () => vaults.find(v => v.name === DEFAULT_VAULT_NAME)?.name ?? vaults[0]?.name ?? '',
  );

  const selectForDeposit = (name: string) => {
    setSelected(name);
    document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-8">
      <NextPrompt next="done" />
      <Callout>
        <strong>Real funds on mainnet.</strong> These vaults are leveraged: the APR is variable and can go negative, the
        share price can fall, and the only exit is a withdraw. Use small amounts (about $5).
      </Callout>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
        <VaultBrowser vaults={vaults} selected={selected} onSelect={selectForDeposit} usdPrice={usdPrice} />
        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <DepositCard vaults={vaults} vaultName={selected} onVaultChange={setSelected} usdPrice={usdPrice} />
          <WithdrawCard vaults={vaults} vaultName={selected} onVaultChange={setSelected} />
        </div>
      </div>
    </div>
  );
}
