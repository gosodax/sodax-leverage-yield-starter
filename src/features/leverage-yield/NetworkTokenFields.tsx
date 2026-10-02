import type { XToken } from '@sodax/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { Field } from './Field';

/** The token to preselect after a network change: USDC where it exists, else the first offered token. */
export function defaultTokenFor(chainKey: SourceChainKey): XToken | undefined {
  return getTokenByKey(chainKey, DEFAULT_TOKEN_KEY) ?? getDepositTokens(chainKey)[0];
}

type Props = {
  chainKey: SourceChainKey;
  token: XToken | undefined;
  onChange: (chainKey: SourceChainKey, token: XToken | undefined) => void;
  chainLabel: string;
  tokenLabel: string;
  /** Limit the networks offered (withdraw only lists networks that hold shares for deposits). */
  chains?: readonly SourceChainKey[];
};

/** A network select and a token select that keep each other valid. */
export function NetworkTokenFields({
  chainKey,
  token,
  onChange,
  chainLabel,
  tokenLabel,
  chains = SOURCE_CHAINS,
}: Props) {
  const tokens = getDepositTokens(chainKey);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={chainLabel}>
        <Select
          value={chainKey}
          onValueChange={value => {
            const next = value as SourceChainKey;
            onChange(next, defaultTokenFor(next));
          }}
        >
          <SelectTrigger aria-label={chainLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chains.map(key => (
              <SelectItem key={key} value={key}>
                {chainName(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={tokenLabel}>
        <Select
          value={token?.address}
          onValueChange={address =>
            onChange(
              chainKey,
              tokens.find(t => t.address === address),
            )
          }
        >
          <SelectTrigger aria-label={tokenLabel}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {tokens.map(t => (
              <SelectItem key={t.address} value={t.address}>
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
