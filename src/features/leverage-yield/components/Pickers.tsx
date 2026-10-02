import type { LeverageYieldVault, XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount } from '@/lib/format';
import { underlying } from '../lib/vaults';
import { ChainIcon, TokenIcon } from './TokenIcon';

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function VaultSelect({
  vaults,
  value,
  onChange,
}: {
  vaults: readonly LeverageYieldVault[];
  value: string | undefined;
  onChange: (name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Vault">
        <SelectValue placeholder="Choose a vault" />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(vault => (
          <SelectItem key={vault.name} value={vault.name}>
            <TokenIcon symbol={underlying(vault).symbol} className="size-5" />
            {underlying(vault).symbol} Vault
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChainSelect({
  chains,
  value,
  onChange,
  label = 'Network',
}: {
  chains: readonly SourceChainKey[];
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chains.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <ChainIcon chainKey={chainKey} />
            {chainName(chainKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TokenSelect({
  tokens,
  value,
  onChange,
  balanceOf,
}: {
  tokens: readonly XToken[];
  value: string | undefined;
  onChange: (address: string) => void;
  balanceOf?: (token: XToken) => bigint | undefined;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Token">
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(token => {
          const balance = balanceOf?.(token);
          return (
            <SelectItem key={token.address} value={token.address}>
              <TokenIcon symbol={token.symbol} className="size-5" />
              <span>{token.symbol}</span>
              {balance !== undefined && balance > 0n && (
                <span className="ml-auto pl-3 font-mono text-xs text-muted-foreground">
                  {formatTokenAmount(balance, token.decimals)}
                </span>
              )}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
