import type { XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TokenSelect({
  tokens,
  value,
  onChange,
}: {
  tokens: XToken[];
  value: string | undefined;
  onChange: (address: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Token">
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
  );
}
