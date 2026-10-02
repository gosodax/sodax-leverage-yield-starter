import type { XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTokenAmount } from '@/lib/format';
import type { TokenOption } from '../hooks/useSourceEligibility';

/**
 * Token picker. With `options` (deposit sources for a connected wallet), each token shows its balance and tokens the
 * wallet can't use are greyed out with the reason. Without, every token is offered (withdraw destinations).
 */
export function TokenSelect({
  tokens,
  options,
  value,
  onChange,
}: {
  tokens: XToken[];
  options?: TokenOption[];
  value: string | undefined;
  onChange: (address: string) => void;
}) {
  const byAddress = new Map(options?.map(option => [option.token.address, option]));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Token">
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(token => {
          const option = byAddress.get(token.address);
          const disabled = option ? !option.eligible : false;
          return (
            <SelectItem
              key={token.address}
              value={token.address}
              disabled={disabled}
              aside={
                option && (option.balance !== undefined || option.reason) ? (
                  <>
                    {option.balance !== undefined && <span>{formatTokenAmount(option.balance, token.decimals)}</span>}
                    {option.reason && <span>{option.reason}</span>}
                  </>
                ) : undefined
              }
            >
              {token.symbol}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
