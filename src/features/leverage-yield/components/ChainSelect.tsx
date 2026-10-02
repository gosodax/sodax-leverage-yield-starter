import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { cn } from '@/lib/utils';

export function ChainSelect({
  value,
  onChange,
  chains = SOURCE_CHAINS,
  label = 'Network',
  inline,
  className,
}: {
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  /** Networks to offer (default: every source network). */
  chains?: readonly SourceChainKey[];
  label?: string;
  /** Small and borderless, to sit inside a sentence ("on Base ▾"). */
  inline?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          inline && 'h-8 w-auto gap-1 rounded-full border-0 bg-transparent px-2 font-medium text-foreground',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chains.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <span className="flex items-center gap-2">
              <img src={chainLogo(chainKey)} alt="" className="size-5 rounded-full" />
              {chainName(chainKey)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
