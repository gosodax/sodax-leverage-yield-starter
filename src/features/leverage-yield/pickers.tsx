import type { SpokeChainKey, XToken } from '@sodax/sdk';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';

export function ChainSelect({
  value,
  onChange,
  chains,
  id,
}: {
  value: SourceChainKey;
  onChange: (chain: SourceChainKey) => void;
  chains: readonly SourceChainKey[];
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chains.map(chain => (
          <SelectItem key={chain} value={chain}>
            <ChainBadge chainKey={chain} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChainBadge({ chainKey }: { chainKey: SpokeChainKey }) {
  const logo = chainLogo(chainKey);
  return (
    <span className="inline-flex items-center gap-2">
      {logo && <img src={logo} alt="" className="size-4 rounded-full" />}
      {chainName(chainKey)}
    </span>
  );
}

export function TokenSelect({
  value,
  onChange,
  tokens,
  id,
}: {
  value: string;
  onChange: (address: string) => void;
  tokens: XToken[];
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(t => (
          <SelectItem key={t.address} value={t.address}>
            {t.symbol}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function VaultSelect({
  value,
  onChange,
  vaults,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  vaults: { name: string; shareSymbol: string; assetSymbol: string }[];
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Vault" />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(v => (
          <SelectItem key={v.name} value={v.name}>
            {v.shareSymbol} <span className="text-muted-foreground">· {v.assetSymbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
