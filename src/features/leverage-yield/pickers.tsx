import { tokenLogo, type XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import type { VaultInfo } from './useVaults';

function Logo({ src }: { src: string | undefined }) {
  return src ? <img src={src} alt="" className="size-5 shrink-0 rounded-full" /> : null;
}

export function ChainSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger id={id} aria-label="Network">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_CHAINS.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <Logo src={chainLogo(chainKey)} />
            {chainName(chainKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TokenSelect({
  id,
  tokens,
  value,
  onChange,
}: {
  id?: string;
  tokens: XToken[];
  value: XToken;
  onChange: (token: XToken) => void;
}) {
  return (
    <Select
      value={value.address}
      onValueChange={address => {
        const token = tokens.find(t => t.address === address);
        if (token) onChange(token);
      }}
    >
      <SelectTrigger id={id} aria-label="Token">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(token => (
          <SelectItem key={token.address} value={token.address}>
            <Logo src={tokenLogo(token.symbol)} />
            {token.symbol}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function VaultSelect({
  id,
  vaults,
  value,
  onChange,
}: {
  id?: string;
  vaults: VaultInfo[];
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label="Vault">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(v => (
          <SelectItem key={v.vault.name} value={v.vault.name}>
            <Logo src={v.logo} />
            {v.shareSymbol}
            <span className="text-muted-foreground">· {v.assetSymbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
