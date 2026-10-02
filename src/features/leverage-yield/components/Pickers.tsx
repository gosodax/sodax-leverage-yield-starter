import type { XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground">{children}</span>
  );
}

export function ChainPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={v => onChange(v as SourceChainKey)} disabled={disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_CHAINS.map(chainKey => (
            <SelectItem key={chainKey} value={chainKey}>
              <ChainLogo chainKey={chainKey} />
              {chainName(chainKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ChainLogo({ chainKey }: { chainKey: SourceChainKey }) {
  const src = chainLogo(chainKey);
  return src ? <img src={src} alt="" className="size-4 rounded-full" /> : null;
}

export function TokenPicker({
  tokens,
  value,
  onChange,
  label,
  disabled,
}: {
  tokens: XToken[];
  value: XToken | undefined;
  onChange: (token: XToken) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value?.address}
        onValueChange={address => {
          const token = tokens.find(t => t.address === address);
          if (token) onChange(token);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Token" />
        </SelectTrigger>
        <SelectContent>
          {tokens.map(token => (
            <SelectItem key={token.address} value={token.address}>
              {token.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
