import type { LeverageYieldVault } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vaultMeta } from '../lib/vaults';

export function VaultSelect({
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
      <SelectTrigger aria-label="Vault">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(vault => (
          <SelectItem key={vault.name} value={vault.name}>
            <span className="font-medium">{vault.name}</span>
            <span className="text-xs text-muted-foreground">{vaultMeta(vault).asset}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
