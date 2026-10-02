import type { LeverageYieldVault } from '@sodax/types';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SourceChainKey } from '@/config/workshop';
import { formatRayPercent } from '@/lib/format';
import type { VaultStats } from '../api/useTransportReads';
import type { UsdPrices } from '../lib/usd';
import { underlying, vaultTagline, vaultTitle } from '../lib/vaults';
import { DepositForm } from './DepositForm';
import { Segmented } from './Segmented';
import { TokenIcon } from './TokenIcon';
import { WithdrawTab } from './WithdrawTab';

export type VaultTab = 'deposit' | 'withdraw';

const TABS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
] as const;

/** One vault's Deposit / Withdraw dialog. It can't be closed, and tabs can't switch, while a transaction runs. */
export function VaultDialog({
  vault,
  stats,
  prices,
  initialTab,
  heldUnder,
  onClose,
}: {
  vault: LeverageYieldVault;
  stats: VaultStats;
  prices: UsdPrices;
  initialTab: VaultTab;
  /** For the Withdraw tab: the network whose shares to start on. */
  heldUnder?: SourceChainKey;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<VaultTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const title = vaultTitle(vault);
  const apr = stats.apr.data;

  return (
    <Dialog open onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="max-w-3xl gap-5" onInteractOutside={event => busy && event.preventDefault()}>
        <DialogHeader className="flex-row items-center gap-3">
          <TokenIcon symbol={underlying(vault).symbol} className="size-10" />
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-display text-2xl">
              {tab === 'deposit' ? `Deposit into ${title}` : `Withdraw from ${title}`}
            </DialogTitle>
            <DialogDescription>
              {vaultTagline(vault)}
              {apr && ` · ${formatRayPercent(apr.effectiveNetAprRay)} net APR`}
            </DialogDescription>
          </div>
        </DialogHeader>
        <Segmented
          label="Deposit or withdraw"
          options={TABS}
          value={tab}
          onChange={setTab}
          disabled={busy}
          className="justify-self-start"
        />
        {tab === 'deposit' ? (
          <DepositForm vault={vault} stats={stats} prices={prices} onBusyChange={setBusy} onClose={onClose} />
        ) : (
          <WithdrawTab
            vault={vault}
            stats={stats}
            prices={prices}
            heldUnder={heldUnder}
            onBusyChange={setBusy}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
