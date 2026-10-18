import type { LeverageYieldVault } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { underlying, yieldSource } from '../lib/vaults';
import { VaultApr } from './VaultApr';

export function VaultPicker({
  vaults,
  value,
  onChange,
}: {
  vaults: readonly LeverageYieldVault[];
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Vault" className="h-14">
        <SelectValue placeholder="Choose a vault" />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(vault => (
          <SelectItem key={vault.name} value={vault.name}>
            <span className="flex flex-col">
              <span className="font-semibold">
                {vault.name} <span className="font-normal text-muted-foreground">· {underlying(vault).symbol}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {yieldSource(vault)} · <VaultApr vault={vault.vault} />
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
