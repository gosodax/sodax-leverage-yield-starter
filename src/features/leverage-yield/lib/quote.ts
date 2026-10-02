import { ChainKeys, type LeverageYieldQuoteParams } from '@sodax/dapp-kit';
import type { Address } from 'viem';
import { MAX_SLIPPAGE_BPS, type SourceChainKey } from '@/config/workshop';

type DepositQuoteInput = {
  inputToken: Address;
  sourceChain: SourceChainKey;
  vault: Address;
  inputAmount: bigint;
};

type WithdrawQuoteInput = {
  outputToken: Address;
  destinationChain: SourceChainKey;
  vault: Address;
  shares: bigint;
};

/** Returns the user-protecting floor for a valid, live quote. */
export function minimumOutputFromQuote(quotedAmount: bigint, slippageBps: number): bigint | undefined {
  if (quotedAmount <= 0n || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) return undefined;
  const minimum = (quotedAmount * BigInt(10_000 - slippageBps)) / 10_000n;
  return minimum > 0n ? minimum : undefined;
}

/** A vault deposit quotes the selected spoke asset into the Sonic vault share token. */
export function buildDepositQuotePayload({
  inputToken,
  sourceChain,
  vault,
  inputAmount,
}: DepositQuoteInput): LeverageYieldQuoteParams {
  return {
    token_src: inputToken,
    token_src_blockchain_id: sourceChain,
    token_dst: vault,
    token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
    amount: inputAmount,
    quote_type: 'exact_input',
  };
}

/** A vault withdrawal quotes Sonic vault shares into the selected spoke asset. */
export function buildWithdrawQuotePayload({
  outputToken,
  destinationChain,
  vault,
  shares,
}: WithdrawQuoteInput): LeverageYieldQuoteParams {
  return {
    token_src: vault,
    token_src_blockchain_id: ChainKeys.SONIC_MAINNET,
    token_dst: outputToken,
    token_dst_blockchain_id: destinationChain,
    amount: shares,
    quote_type: 'exact_input',
  };
}
