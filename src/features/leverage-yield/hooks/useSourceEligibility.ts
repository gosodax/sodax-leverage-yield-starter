import { getBalancesQueryOptions, useSodaxContext } from '@sodax/dapp-kit';
import { isNativeToken, type XToken } from '@sodax/types';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getDepositTokens,
  getNativeToken,
  MIN_GAS_BALANCE,
  NATIVE_GAS_RESERVE,
  REFETCH_MS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';

/** Why a token or network can't be used right now. Undefined when it can (or when we can't tell yet). */
export type Eligibility = { eligible: true; reason?: undefined } | { eligible: false; reason: string };

const OK: Eligibility = { eligible: true };

/** Deposit tokens plus the native gas token (POL, BNB, AVAX and HYPE are gas but not deposit tokens). */
function sourceTokens(chainKey: SourceChainKey): XToken[] {
  const tokens = getDepositTokens(chainKey);
  const native = getNativeToken(chainKey);
  return native && !tokens.some(token => token.address === native.address) ? [...tokens, native] : tokens;
}

export type TokenOption = { token: XToken; balance: bigint | undefined } & Eligibility;

export type ChainOption = { chainKey: SourceChainKey } & Eligibility;

export type SourceEligibility = {
  /** False when no wallet is connected: every option is enabled, as before. */
  active: boolean;
  chains: Record<SourceChainKey, ChainOption>;
  tokens: (chainKey: SourceChainKey) => TokenOption[];
  balance: (chainKey: SourceChainKey, token: XToken | undefined) => bigint | undefined;
  isLoading: (chainKey: SourceChainKey) => boolean;
};

/**
 * Which deposit sources the connected wallet can actually use. One balances query per source network (every
 * deposit token there, native gas included), cached and shared through react-query and refreshed every REFETCH_MS.
 *
 * A token is eligible when the wallet holds some of it AND holds more than MIN_GAS_BALANCE of native gas on that
 * network. A native token used as the deposit asset must also exceed NATIVE_GAS_RESERVE, so gas is left over.
 * While a network's balances are loading (or failed to load) its options stay enabled.
 */
export function useSourceEligibility(address: string | undefined): SourceEligibility {
  const { sodax } = useSodaxContext();
  const results = useQueries({
    queries: SOURCE_CHAINS.map(chainKey => ({
      ...getBalancesQueryOptions(sodax, { chainKey, tokens: sourceTokens(chainKey), address }),
      refetchInterval: REFETCH_MS,
    })),
  });

  const dataKey = results.map(result => result.dataUpdatedAt).join(',');
  const loadingKey = results.map(result => result.isLoading).join(',');

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when any network's data or loading state changes
  return useMemo(() => {
    const active = !!address;
    const byChain = new Map<SourceChainKey, Record<string, bigint> | undefined>();
    const loading = new Map<SourceChainKey, boolean>();
    SOURCE_CHAINS.forEach((chainKey, index) => {
      byChain.set(chainKey, results[index]?.data as Record<string, bigint> | undefined);
      loading.set(chainKey, !!results[index]?.isLoading);
    });

    const gasOf = (chainKey: SourceChainKey): bigint | undefined => {
      const balances = byChain.get(chainKey);
      const native = getNativeToken(chainKey);
      return balances && native ? (balances[native.address] ?? 0n) : undefined;
    };

    const chainOption = (chainKey: SourceChainKey): ChainOption => {
      const gas = gasOf(chainKey);
      if (!active || gas === undefined || gas > MIN_GAS_BALANCE[chainKey]) return { chainKey, ...OK };
      return { chainKey, eligible: false, reason: 'No gas' };
    };

    const chains = Object.fromEntries(SOURCE_CHAINS.map(chainKey => [chainKey, chainOption(chainKey)])) as Record<
      SourceChainKey,
      ChainOption
    >;

    const tokens = (chainKey: SourceChainKey): TokenOption[] => {
      const balances = byChain.get(chainKey);
      const gasOk = chains[chainKey].eligible;
      return getDepositTokens(chainKey).map(token => {
        const balance = balances?.[token.address];
        if (!active || !balances) return { token, balance, ...OK };
        if (!balance || balance <= 0n) return { token, balance, eligible: false, reason: 'No balance' };
        if (!gasOk) return { token, balance, eligible: false, reason: `No gas on ${chainName(chainKey)}` };
        if (isNativeToken(chainKey, token) && balance <= NATIVE_GAS_RESERVE[chainKey]) {
          return { token, balance, eligible: false, reason: 'Only enough for gas' };
        }
        return { token, balance, ...OK };
      });
    };

    return {
      active,
      chains,
      tokens,
      balance: (chainKey, token) => (token ? byChain.get(chainKey)?.[token.address] : undefined),
      isLoading: chainKey => !!loading.get(chainKey),
    };
  }, [address, dataKey, loadingKey]);
}
