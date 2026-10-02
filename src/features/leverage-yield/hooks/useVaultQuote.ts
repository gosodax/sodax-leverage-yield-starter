import { useLeverageYieldQuote } from '@sodax/dapp-kit';
import { ChainKeys, type LeverageYieldVault, type SpokeChainKey, type XToken } from '@sodax/types';
import { DEFAULT_SLIPPAGE_BPS, REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';
import { quoteError } from '../lib/errors';

type Leg = {
  vault: LeverageYieldVault;
  chainKey: SpokeChainKey;
  token: XToken | undefined;
  amount: bigint | undefined;
};

function useQuote(payload: Parameters<typeof useLeverageYieldQuote>[0]) {
  const query = useLeverageYieldQuote(payload);
  const result = query.data;
  const quoted = result?.ok ? result.value.quoted_amount : undefined;
  return {
    quoted,
    /** Never zero: derived from the live quote at DEFAULT_SLIPPAGE_BPS. */
    minOut: quoted !== undefined && quoted > 0n ? minAmountAfterSlippage(quoted, DEFAULT_SLIPPAGE_BPS) : undefined,
    error: result && !result.ok ? quoteError(result.error) : query.error ? quoteError(query.error) : undefined,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/** Spoke token → vault shares (delivered on Sonic). */
export function useDepositQuote({ vault, chainKey, token, amount }: Leg) {
  return useQuote({
    params: {
      payload:
        token && amount && amount > 0n
          ? {
              token_src: token.address,
              token_src_blockchain_id: chainKey,
              token_dst: vault.vault,
              token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
              amount,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
}

/** Vault shares → a token on the chosen network. */
export function useWithdrawQuote({ vault, chainKey, token, amount }: Leg) {
  return useQuote({
    params: {
      payload:
        token && amount && amount > 0n
          ? {
              token_src: vault.vault,
              token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
              token_dst: token.address,
              token_dst_blockchain_id: chainKey,
              amount,
              quote_type: 'exact_input',
            }
          : undefined,
    },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
}
