import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type SpokeChainKey, type XToken } from '@sodax/types';
import { useMemo } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';
import { quoteErrorMessage } from '../lib/errors';
import { useDebouncedValue } from './useDebouncedValue';

export type VaultQuote = {
  /** Expected output, smallest units (lsoda* shares are 18 dp). */
  amountOut: bigint | undefined;
  /** After slippage: what goes into `minOutputAmount`. Never 0 when defined. */
  minAmountOut: bigint | undefined;
  error: string | undefined;
  isLoading: boolean;
  /** True while the quote on screen is for an older amount than the one typed. */
  isStale: boolean;
  updatedAt: number;
  refetch: () => unknown;
};

/**
 * Live quote for a vault deposit (token → shares) or withdraw (shares → token), via `useLeverageYieldQuote`
 * (it deducts the leverage-yield fee, so the quote matches what the intent will charge). The vault address is
 * the lsoda* token on Sonic: `token_dst` for a deposit, `token_src` for a withdraw.
 */
export function useVaultQuote(
  args:
    | { direction: 'deposit'; vault?: LeverageYieldVault; chainKey: SpokeChainKey; token?: XToken; amount?: bigint }
    | { direction: 'withdraw'; vault?: LeverageYieldVault; chainKey: SpokeChainKey; token?: XToken; amount?: bigint },
  slippageBps: number,
): VaultQuote {
  const amount = useDebouncedValue(args.amount);
  const { direction, vault, chainKey, token } = args;

  const payload = useMemo(() => {
    if (!vault || !token || !amount || amount <= 0n) return undefined;
    const side = { token: token.address, chain: chainKey };
    const hub = { token: vault.vault, chain: ChainKeys.SONIC_MAINNET };
    const [src, dst] = direction === 'deposit' ? [side, hub] : [hub, side];
    return {
      token_src: src.token,
      token_src_blockchain_id: src.chain,
      token_dst: dst.token,
      token_dst_blockchain_id: dst.chain,
      amount,
      quote_type: 'exact_input' as const,
    };
  }, [direction, vault, chainKey, token, amount]);

  const query = useLeverageYieldQuote({ params: { payload }, queryOptions: { refetchInterval: REFETCH_MS } });
  const result = payload ? query.data : undefined;
  const amountOut = result?.ok ? result.value.quoted_amount : undefined;
  const minAmountOut = amountOut !== undefined ? minAmountAfterSlippage(amountOut, slippageBps) : undefined;

  return {
    amountOut,
    minAmountOut: minAmountOut && minAmountOut > 0n ? minAmountOut : undefined,
    error: result && !result.ok ? quoteErrorMessage(result.error) : undefined,
    isLoading: (!!payload && query.isFetching && !result) || args.amount !== amount,
    isStale: args.amount !== amount,
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}
