import { useState } from 'react';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { DepositForm } from './DepositForm';
import { VaultCard } from './VaultCard';
import { useVaults } from './vaults';
import { WithdrawForm } from './WithdrawForm';

type Mode = 'deposit' | 'withdraw';

/** Mount point for the Leverage Yield feature: vault browser, deposit and withdraw. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const [vaultName, setVaultName] = useState(
    vaults.some(v => v.name === DEFAULT_VAULT_NAME) ? DEFAULT_VAULT_NAME : (vaults[0]?.name ?? ''),
  );
  const [mode, setMode] = useState<Mode>('deposit');

  return (
    <div className="flex flex-col gap-6">
      <NextPrompt next="done" />
      <Callout>
        Leveraged yield vaults run on mainnet with real funds. Net APR is variable and can go negative, the share price
        can fall, and exit is only via withdraw.
      </Callout>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <section aria-label="Vaults" className="grid gap-4 sm:grid-cols-2">
          {vaults.map(v => (
            <VaultCard
              key={v.name}
              vault={v}
              selected={v.name === vaultName}
              onDeposit={() => {
                setVaultName(v.name);
                setMode('deposit');
              }}
            />
          ))}
        </section>
        <Card className="self-start">
          <CardHeader>
            <div role="tablist" className="flex gap-2">
              {(['deposit', 'withdraw'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <CardTitle className="sr-only">{mode}</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === 'deposit' ? (
              <DepositForm vaults={vaults} vaultName={vaultName} onVaultChange={setVaultName} />
            ) : (
              <WithdrawForm vaults={vaults} vaultName={vaultName} onVaultChange={setVaultName} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
