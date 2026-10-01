import { useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys, type SpokeChainKey, type XToken } from '@sodax/types';
import { useMemo } from 'react';
import type { Address } from 'viem';
import { SOURCE_CHAINS } from '@/config/workshop';

export type Vault = { name: string; vault: Address; asset: Address; borrowToken: Address };

/** Vaults from the SDK registry (never hard-coded). */
export function useVaults(): Vault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => [...sodax.leverageYield.listVaults()] as Vault[], [sodax]);
}

/** Underlying LST label, e.g. lsodaWEETH -> WEETH. */
export function vaultAssetLabel(name: string): string {
  return name.replace(/^lsoda/, '');
}

export const HUB_CHAIN = ChainKeys.SONIC_MAINNET;

/** Quote token fields for a deposit (token -> vault) or withdraw (vault -> token). */
export function depositQuotePayload(srcChain: SpokeChainKey, token: XToken, vault: Address, amount: bigint) {
  return {
    token_src: token.address,
    token_src_blockchain_id: srcChain,
    token_dst: vault,
    token_dst_blockchain_id: HUB_CHAIN,
    amount,
    quote_type: 'exact_input' as const,
  };
}

export function withdrawQuotePayload(dstChain: SpokeChainKey, token: XToken, vault: Address, shares: bigint) {
  return {
    token_src: vault,
    token_src_blockchain_id: HUB_CHAIN,
    token_dst: token.address,
    token_dst_blockchain_id: dstChain,
    amount: shares,
    quote_type: 'exact_input' as const,
  };
}

/** Holder list for share balances: the connected EOA on every source chain. */
export function useHolders(address: string | undefined) {
  return useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey: chainKey as SpokeChainKey, address })) : undefined),
    [address],
  );
}
