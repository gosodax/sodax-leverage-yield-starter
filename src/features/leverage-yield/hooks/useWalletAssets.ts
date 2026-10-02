import { useBalances } from '@sodax/dapp-kit';
import { ChainKeys, type XToken } from '@sodax/types';
import { useMemo } from 'react';
import { getDepositTokens, NATIVE_GAS_RESERVE, REFETCH_MS, type SourceChainKey } from '@/config/workshop';
import { priceFor, toUsd, type UsdPrices } from '../lib/usd';

export type WalletAsset = {
  chainKey: SourceChainKey;
  token: XToken;
  balance: bigint;
  /** Balance minus the gas reserve for native tokens: what the user can actually deposit. */
  spendable: bigint;
  usd: number | undefined;
};

const NATIVE = '0x0000000000000000000000000000000000000000';

export function isNative(token: XToken): boolean {
  return token.address.toLowerCase() === NATIVE;
}

/** What the user can deposit of `token`: the balance, less a gas reserve when it is the network's native coin. */
export function spendableOf(chainKey: SourceChainKey, token: XToken, balance: bigint): bigint {
  if (!isNative(token)) return balance;
  const left = balance - NATIVE_GAS_RESERVE[chainKey];
  return left > 0n ? left : 0n;
}

function useChainBalances(chainKey: SourceChainKey, address: string | undefined) {
  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const query = useBalances({
    params: { chainKey, tokens, address },
    queryOptions: { refetchInterval: REFETCH_MS * 3 },
  });
  return { tokens, balances: query.data, isLoading: query.isLoading && !!address };
}

/**
 * Every deposit-able token the wallet holds across the source networks, richest first. Powers the
 * "fund from" suggestions and the balance shown in the token picker. One balance batch per network.
 */
export function useWalletAssets(address: string | undefined, prices: UsdPrices) {
  const base = useChainBalances(ChainKeys.BASE_MAINNET, address);
  const arb = useChainBalances(ChainKeys.ARBITRUM_MAINNET, address);
  const sonic = useChainBalances(ChainKeys.SONIC_MAINNET, address);

  return useMemo(() => {
    const perChain: [SourceChainKey, typeof base][] = [
      [ChainKeys.BASE_MAINNET, base],
      [ChainKeys.ARBITRUM_MAINNET, arb],
      [ChainKeys.SONIC_MAINNET, sonic],
    ];
    const assets: WalletAsset[] = perChain.flatMap(([chainKey, { tokens, balances }]) =>
      tokens.flatMap(token => {
        const balance = balances?.[token.address] ?? 0n;
        if (balance === 0n) return [];
        const spendable = spendableOf(chainKey, token, balance);
        return [
          { chainKey, token, balance, spendable, usd: toUsd(spendable, token.decimals, priceFor(prices, token.vault)) },
        ];
      }),
    );
    assets.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
    return {
      assets,
      isLoading: base.isLoading || arb.isLoading || sonic.isLoading,
      balanceOf: (chainKey: SourceChainKey, token: XToken | undefined) =>
        token ? perChain.find(([key]) => key === chainKey)?.[1].balances?.[token.address] : undefined,
    };
  }, [base, arb, sonic, prices]);
}
