import { useState } from 'react';
import { DEFAULT_VAULT_NAME, SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { useEvmWallet } from '@/wallet';
import { DepositDialog } from './DepositDialog';
import { Positions } from './Positions';
import { VaultCard } from './VaultCard';
import { useVaults, type VaultMeta } from './vaults';
import { WithdrawDialog } from './WithdrawDialog';

type ActionInput =
  | { kind: 'deposit'; meta: VaultMeta }
  | { kind: 'withdraw'; meta: VaultMeta; chainKey?: SourceChainKey };
type Action = ActionInput & { id: number };

/** SODAX Leverage Yield: browse the vaults, deposit from any supported network, hold and withdraw shares. */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [action, setAction] = useState<Action>();
  const [open, setOpen] = useState(false);

  // Default vault first; the rest keep registry order.
  const ordered = [...vaults].sort((a, b) =>
    a.vault.name === DEFAULT_VAULT_NAME ? -1 : b.vault.name === DEFAULT_VAULT_NAME ? 1 : 0,
  );

  const start = (next: ActionInput) => {
    // A fresh id remounts the dialog, so each flow starts from a clean form.
    setAction({ ...next, id: Date.now() });
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-10">
      {address && (
        <Positions
          vaults={ordered}
          address={address}
          onWithdraw={(meta, chainKey) => start({ kind: 'withdraw', meta, chainKey })}
        />
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">Vaults</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pooled ERC-4626 vaults on Sonic. Each holds a liquid staking token, borrows against it and re-stakes up to a
            target LTV, multiplying the staking yield and the risk. Deposit any supported token from{' '}
            {SOURCE_CHAINS.map(chainName).join(', ')}; a solver delivers the vault shares.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {ordered.map(meta => (
            <VaultCard
              key={meta.vault.name}
              meta={meta}
              address={address}
              onDeposit={() => start({ kind: 'deposit', meta })}
              onWithdraw={() => start({ kind: 'withdraw', meta })}
            />
          ))}
        </div>
      </section>

      {action?.kind === 'deposit' && (
        <DepositDialog key={action.id} meta={action.meta} open={open} onOpenChange={setOpen} />
      )}
      {action?.kind === 'withdraw' && (
        <WithdrawDialog
          key={action.id}
          meta={action.meta}
          initialChain={action.chainKey}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}
