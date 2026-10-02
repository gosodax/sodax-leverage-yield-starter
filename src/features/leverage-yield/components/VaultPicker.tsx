import type { LeverageYieldVault } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vaultBrand } from '../lib/brands';
import { VaultApr } from './VaultApr';
import { VaultIcon } from './VaultIcon';

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
            <VaultIcon vault={vault} size={24} />
            <span className="font-medium">{vaultBrand(vault).name}</span>
            <Badge variant="muted">{vaultBrand(vault).ticker}</Badge>
            <span className="text-muted-foreground">
              · <VaultApr vault={vault.vault} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
