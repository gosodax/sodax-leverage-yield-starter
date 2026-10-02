import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { DepositForm } from './DepositForm';
import { VaultSpotlight } from './VaultSpotlight';
import { VaultTable } from './VaultTable';
import { useVaults } from './vaults';
import { WithdrawForm } from './WithdrawForm';
import { YourPosition } from './YourPosition';

export function LeverageYieldPage() {
  const vaults = useVaults();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const railRef = useRef<HTMLDivElement>(null);

  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const selectedName = vault?.name ?? vaultName;

  const handleDepositClick = (name: string) => {
    setVaultName(name);
    setTab('deposit');
    railRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (vaults.length === 0 || !vault) {
    return (
      <div className="flex flex-col gap-4">
        <NextPrompt next="done" />
        <p className="text-center text-sm text-muted-foreground">No leverage-yield vaults are registered in the SDK.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <NextPrompt next="done" />

      <VaultSpotlight vault={vault} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Markets</h2>
              <span className="text-xs text-muted-foreground">{vaults.length} vaults · Sonic</span>
            </div>
            <VaultTable
              vaults={vaults}
              selectedVaultName={selectedName}
              onSelect={setVaultName}
              onDeposit={handleDepositClick}
            />
          </section>
          <YourPosition vault={vault} />
        </div>

        <div ref={railRef} className="flex scroll-mt-6 flex-col gap-2.5 lg:sticky lg:top-6">
          <div className="flex gap-1 self-start rounded-full bg-secondary p-1" role="tablist" aria-label="Action">
            <Button
              role="tab"
              aria-selected={tab === 'deposit'}
              size="sm"
              variant={tab === 'deposit' ? 'default' : 'ghost'}
              onClick={() => setTab('deposit')}
            >
              Deposit
            </Button>
            <Button
              role="tab"
              aria-selected={tab === 'withdraw'}
              size="sm"
              variant={tab === 'withdraw' ? 'default' : 'ghost'}
              onClick={() => setTab('withdraw')}
            >
              Withdraw
            </Button>
          </div>
          {tab === 'deposit' ? (
            <DepositForm vaults={vaults} vaultName={selectedName} onVaultChange={setVaultName} />
          ) : (
            <WithdrawForm vaults={vaults} vaultName={selectedName} onVaultChange={setVaultName} />
          )}
        </div>
      </div>
    </div>
  );
}
