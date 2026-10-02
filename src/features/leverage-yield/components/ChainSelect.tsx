import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import type { ChainOption } from '../hooks/useSourceEligibility';

/** Network picker. With `options`, networks where the wallet has no gas are greyed out ("No gas"). */
export function ChainSelect({
  value,
  options,
  onChange,
}: {
  value: SourceChainKey;
  options?: Record<SourceChainKey, ChainOption>;
  onChange: (chainKey: SourceChainKey) => void;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger aria-label="Network">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_CHAINS.map(chainKey => {
          const option = options?.[chainKey];
          return (
            <SelectItem
              key={chainKey}
              value={chainKey}
              disabled={option ? !option.eligible : false}
              aside={option?.reason}
            >
              <img src={chainLogo(chainKey)} alt="" className="size-5 rounded-full" />
              {chainName(chainKey)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
