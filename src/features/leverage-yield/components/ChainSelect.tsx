import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';

export function ChainSelect({
  value,
  onChange,
}: {
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger aria-label="Network">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_CHAINS.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <img src={chainLogo(chainKey)} alt="" className="size-5 rounded-full" />
            {chainName(chainKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
