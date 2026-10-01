import { useXBalances } from '@sodax/dapp-kit';
import { isSodaxError } from '@sodax/sdk';
import type { SpokeChainKey, XToken } from '@sodax/types';
import { useXService } from '@sodax/wallet-sdk-react';
import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REFETCH_MS, SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';

export function ChainLabel({ chainKey }: { chainKey: SpokeChainKey }) {
  const logo = chainLogo(chainKey);
  return (
    <span className="flex items-center gap-2">
      {logo && <img src={logo} alt="" className="size-4 rounded-full" />}
      {chainName(chainKey)}
    </span>
  );
}

export function ChainSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_CHAINS.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <ChainLabel chainKey={chainKey} />
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
  disabled,
  id,
}: {
  tokens: XToken[];
  value: string | undefined;
  onChange: (address: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
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

/** Wallet balance of one token on one EVM network, in the token's smallest unit. */
export function useTokenBalance(chainKey: SpokeChainKey, token: XToken | undefined, address: string | undefined) {
  const xService = useXService({ xChainType: 'EVM' });
  const xTokens = useMemo(() => (token ? [token] : []), [token]);
  const { data, isLoading } = useXBalances({
    params: { xService, xChainId: chainKey, xTokens, address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  return { balance: token ? data?.[token.address] : undefined, isLoading: isLoading && !!address };
}

/** Human text for a failed leverage-yield quote: the solver's own reason, or the SDK error code. */
export function quoteErrorText(error: unknown): string {
  if (isSodaxError(error)) {
    if (error.code === 'VALIDATION_FAILED') return 'That amount cannot be quoted.';
    if (error.code === 'LOOKUP_FAILED') return 'This token is not supported for this vault.';
    return 'Quote unavailable right now. Try again shortly.';
  }
  const detail = (error as { detail?: { message?: string } } | undefined)?.detail;
  return detail?.message ? `No quote: ${detail.message}` : 'No quote available for this route.';
}
