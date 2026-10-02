import type { LeverageYieldVault } from '@sodax/types';
import { useEffect } from 'react';
import { formatRayPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useVaultData } from '../hooks/useVaultData';
import { exposureWad, flavorOf, rayToPct, underlying } from '../lib/vaults';
import { SodaCan } from './SodaCan';

/**
 * The dispenser shelf: one bottle per vault. Fill = APR relative to the best vault on the shelf, fizz = leverage.
 */
export function VaultShelf({
  vaults,
  selected,
  onSelect,
  onOpen,
  aprs,
  onApr,
}: {
  vaults: readonly LeverageYieldVault[];
  selected: string | undefined;
  onSelect: (name: string) => void;
  onOpen: (name: string) => void;
  aprs: Record<string, number>;
  onApr: (name: string, pct: number) => void;
}) {
  const best = Math.max(1, ...Object.values(aprs));
  return (
    <div className="bevel-field relative overflow-hidden p-[3px]">
      {/* machine glass */}
      <div
        className="relative grid grid-cols-2 gap-x-2 gap-y-4 px-3 pt-4 pb-2 sm:grid-cols-4"
        style={{
          background: 'linear-gradient(180deg, var(--win-title-a) 0%, var(--win-desktop) 55%, var(--win-title-a) 100%)',
        }}
        role="listbox"
        aria-label="Vaults"
        aria-orientation="horizontal"
      >
        {/* glass glare */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, transparent 0 18%, var(--win-highlight) 18.5% 22%, transparent 22.5% 26%, var(--win-highlight) 26.3% 27.3%, transparent 27.8%)',
            opacity: 0.12,
          }}
        />
        {vaults.map((vault, index) => (
          <Slot
            key={vault.vault}
            code={`${String.fromCharCode(65 + Math.floor(index / 4))}${(index % 4) + 1}`}
            vault={vault}
            best={best}
            selected={selected === vault.name}
            onSelect={() => onSelect(vault.name)}
            onOpen={() => onOpen(vault.name)}
            onApr={onApr}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  code,
  vault,
  best,
  selected,
  onSelect,
  onOpen,
  onApr,
}: {
  code: string;
  vault: LeverageYieldVault;
  best: number;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onApr: (name: string, pct: number) => void;
}) {
  const { apr } = useVaultData(vault, undefined);
  const flavor = flavorOf(vault);
  const aprRay = apr.data?.effectiveNetAprRay;
  const pct = aprRay !== undefined ? rayToPct(aprRay) : undefined;
  const exposure = apr.data ? Number(exposureWad(apr.data.leverageMultiplierWad)) / 1e18 : 0;

  useEffect(() => {
    if (pct !== undefined) onApr(vault.name, pct);
  }, [pct, vault.name, onApr]);

  const flat = pct !== undefined && pct <= 0;
  const level = pct === undefined ? 0.5 : flat ? 0.12 : 0.22 + 0.72 * (pct / best);

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-selected={selected}
      className="soda-slot group relative flex cursor-pointer flex-col items-center outline-none"
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={event => {
        if (event.key === 'Enter') onOpen();
        if (event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      title={`${flavor.soda}: double-click to deposit`}
    >
      <div className="h-40 sm:h-48">
        <SodaCan
          level={level}
          bubbles={exposure * 2.4}
          color={flavor.color}
          colorDark={flavor.colorDark}
          label={underlying(vault).symbol}
          sublabel={flavor.soda}
          flat={flat}
          loading={apr.isLoading}
        />
      </div>
      {/* shelf lip */}
      <div className="bevel-out -mt-1 h-[6px] w-full" />
      {/* price tag LCD */}
      <div
        className={cn(
          'mt-1.5 flex w-full max-w-[120px] items-center justify-between gap-1 px-1.5 py-1',
          selected ? 'outline outline-1 outline-dotted outline-[var(--accent)]' : '',
        )}
      >
        <span className="bevel-thin-out bg-[var(--win-face)] px-1 font-bold text-[10px]">{code}</span>
        <span className="lcd bevel-thin-in flex-1 px-1.5 py-0.5 text-right text-[13px]" data-negative={flat}>
          {apr.isError ? 'ERR' : aprRay === undefined ? '--.--%' : formatRayPercent(aprRay)}
        </span>
      </div>
      <span
        className={cn(
          'mt-1 px-1 text-[11px]',
          selected ? 'bg-[var(--win-select)] text-[var(--win-select-text)]' : 'text-[var(--win-highlight)]',
        )}
      >
        {flavor.soda}
      </span>
    </div>
  );
}
