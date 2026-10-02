import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { cn } from '@/lib/utils';
import { Babcia } from './Babcia';
import { ClosingBand } from './ClosingBand';
import { DepositCard } from './DepositCard';
import { DistillerySteps } from './DistillerySteps';
import { useVaults } from './helpers';
import { ShotCalculator } from './ShotCalculator';
import { ToastTicker } from './ToastTicker';
import { VaultCard } from './VaultCard';
import { WithdrawCard } from './WithdrawCard';

type Tab = 'deposit' | 'withdraw';

const TABS: { value: Tab; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
];

/**
 * Leverage Yield: browse the vaults, deposit from any supported network and token, see your shares and
 * withdraw. A vault card's buttons select that vault in the form beside it.
 */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const [vaultName, setVaultName] = useState<string>(DEFAULT_VAULT_NAME);
  const [tab, setTab] = useState<Tab>('deposit');

  const select = (name: string, next: Tab) => {
    setVaultName(name);
    setTab(next);
    // On small screens the form sits below the cards; bring it into view.
    document.getElementById('vault-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-12">
      <Babcia />
      <ToastTicker />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="vaults-heading" className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              Leverage Yield
            </span>
            <h2 id="vaults-heading" className="font-display text-4xl leading-tight">
              Vaults
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Pooled vaults that loop a liquid staking token to multiply its yield, and its risk. Your position is the
              vault's{' '}
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground">
                lsoda*
              </code>{' '}
              share token.
            </p>
          </div>
          <div className="vault-grid grid gap-4 sm:grid-cols-2">
            <style>{`
              @media (prefers-reduced-motion: no-preference) and (min-width: 640px) {
                .vault-cell { transition: translate 0.5s cubic-bezier(0.34, 1.4, 0.64, 1), rotate 0.5s ease-out; }
                .vault-cell:nth-child(even) { --dir: -1; }
                .vault-grid:has(.vault-cell:nth-child(odd):hover) .vault-cell:nth-child(even) { translate: 16px 0; rotate: 2deg; }
                .vault-grid:has(.vault-cell:nth-child(even):hover) .vault-cell:nth-child(odd) { translate: -16px 0; rotate: -2deg; }
              }
            `}</style>
            {vaults.map((vault, index) => (
              <div
                key={vault.name}
                className="vault-cell animate-rise-in"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <VaultCard
                  vault={vault}
                  selected={vault.name === vaultName}
                  onDeposit={() => select(vault.name, 'deposit')}
                  onWithdraw={() => select(vault.name, 'withdraw')}
                />
              </div>
            ))}
          </div>
        </section>

        <Card id="vault-actions" className="scroll-mt-4 lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>{tab === 'deposit' ? 'Deposit' : 'Withdraw'}</CardTitle>
            <CardDescription>
              {tab === 'deposit'
                ? 'Pay with a token on a supported network and receive vault shares.'
                : 'Sell your vault shares back into a token on a network you choose.'}
            </CardDescription>
            <fieldset className="mt-2 grid grid-cols-2 gap-1 rounded-full border bg-muted p-1">
              <legend className="sr-only">Action</legend>
              {TABS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={tab === option.value}
                  onClick={() => setTab(option.value)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition-all',
                    tab === option.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
          </CardHeader>
          <CardContent>
            {tab === 'deposit' ? (
              <DepositCard vaultName={vaultName} onVaultChange={setVaultName} />
            ) : (
              <WithdrawCard vaultName={vaultName} onVaultChange={setVaultName} />
            )}
          </CardContent>
        </Card>
      </div>
      <DistillerySteps />
      <ShotCalculator />
      <ClosingBand />
    </div>
  );
}
