import type { XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TokenIcon } from './TokenIcon';

export function TokenSelect({
  tokens,
  value,
  onChange,
  pill,
  className,
}: {
  tokens: XToken[];
  value: string | undefined;
  onChange: (address: string) => void;
  /** A white pill for the amount panels. */
  pill?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Token"
        className={cn(
          pill && 'h-10 w-auto shrink-0 rounded-full border-0 bg-card pr-3 pl-1.5 font-semibold',
          className,
        )}
      >
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(token => (
          <SelectItem key={token.address} value={token.address}>
            <span className="flex items-center gap-2">
              <TokenIcon symbol={token.symbol} className="size-5" />
              {token.symbol}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
