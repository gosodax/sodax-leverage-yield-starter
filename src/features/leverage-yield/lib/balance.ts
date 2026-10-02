/**
 * Public RPC balance reads are advisory. An unavailable read must not prevent the wallet from
 * evaluating a transaction, while a returned balance still protects against a known shortfall.
 */
export function canProceedWithWalletBalance(balance: bigint | undefined, required: bigint): boolean {
  return balance === undefined || balance >= required;
}
