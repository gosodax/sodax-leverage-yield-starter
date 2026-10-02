import { useRef, useState } from 'react';
import { Window } from '@/components/desktop/Window';
import { useWindowManager } from '@/components/desktop/WindowManager';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { DepositForm } from './components/DepositForm';
import { VaultCard } from './components/VaultCard';
import { WithdrawForm } from './components/WithdrawForm';
import { useVaults } from './hooks/useVaults';

type Tab = 'deposit' | 'withdraw';

const PANEL_ID = 'panel';

/**
 * SODAX Leverage Yield: browse the lsoda* vaults, deposit from any supported network and token, see your shares and
 * withdraw back to any network.
 */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(
    () => vaults.find(v => v.name === DEFAULT_VAULT_NAME)?.name ?? vaults[0]?.name,
  );
  const [tab, setTab] = useState<Tab>('deposit');
  const panelRef = useRef<HTMLDivElement>(null);
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const wm = useWindowManager();

  function open(name: string, next: Tab) {
    setVaultName(name);
    setTab(next);
    // Reopen the panel if it was minimized or closed, and bring it to the front.
    wm.open(PANEL_ID);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-8">
      <NextPrompt next="done" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-lg text-primary">Vaults</h2>
            <p className="text-sm text-muted-foreground">
              Pooled ERC-4626 vaults on Sonic that loop a liquid staking token for amplified yield.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {vaults.map(v => (
              <VaultCard
                key={v.name}
                vault={v}
                address={address}
                selected={v.name === vault?.name}
                onDeposit={() => open(v.name, 'deposit')}
                onWithdraw={() => open(v.name, 'withdraw')}
              />
            ))}
          </div>
        </section>

        {vault && (
          <div ref={panelRef} className="scroll-mt-24">
            <Window id={PANEL_ID} title="vault-actions.exe">
              <CardHeader className="pb-4">
                <CardTitle className="sr-only">{tab === 'deposit' ? 'Deposit' : 'Withdraw'}</CardTitle>
                <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="tablist">
                  {(['deposit', 'withdraw'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={cn(
                        'rounded-full py-2 font-display text-[10px] uppercase transition-colors',
                        tab === t
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {tab === 'deposit' ? (
                  <DepositForm vaults={vaults} vault={vault} onVaultChange={setVaultName} />
                ) : (
                  <WithdrawForm vaults={vaults} vault={vault} onVaultChange={setVaultName} />
                )}
              </CardContent>
            </Window>
          </div>
        )}
      </div>
    </div>
  );
}
