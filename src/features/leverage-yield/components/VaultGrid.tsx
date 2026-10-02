import type { LeverageYieldVault } from '@sodax/types';
import { m } from 'motion/react';
import { InfoTip } from '@/components/ui/info-tip';
import { BASE } from '@/components/ui/motion';
import { VaultCard } from './VaultCard';

export function VaultGrid({
  vaults,
  address,
  selected,
  onSelect,
}: {
  vaults: readonly LeverageYieldVault[];
  address: string | undefined;
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        Vaults
        <InfoTip label="How vaults work">
          Each vault holds a liquid staking token, borrows against it and re-stakes it, which multiplies the staking
          yield and the risk. The APR is variable and can turn negative.
        </InfoTip>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          Built for builders
          <InfoTip label="For builders">
            Integrate once with the SODAX SDK and offer these vaults to your users on any supported network.
          </InfoTip>
        </span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Staggered fade and rise on first mount only; a 2px lift on hover. */}
        {vaults.map((vault, index) => (
          <m.div
            key={vault.name}
            className="flex"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ ...BASE, delay: index * 0.05 }}
          >
            <VaultCard
              vault={vault}
              address={address}
              selected={vault.name === selected}
              onDeposit={() => onSelect(vault.name)}
            />
          </m.div>
        ))}
      </div>
    </section>
  );
}
