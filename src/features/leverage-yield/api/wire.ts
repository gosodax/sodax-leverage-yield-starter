import type { IntentRequestV2, IntentResponseV2 } from '@sodax/types';

/** The API speaks decimal strings; convert to bigint (undefined-safe). */
export function toBigInt(value: string | undefined): bigint | undefined {
  return value ? BigInt(value) : undefined;
}

/** Intent from a create-intent response → the shape `/submit-tx` expects (numeric fields as bigint). */
export function toIntentRequest(intent: IntentResponseV2): IntentRequestV2 {
  return {
    ...intent,
    intentId: BigInt(intent.intentId),
    inputAmount: BigInt(intent.inputAmount),
    minOutputAmount: BigInt(intent.minOutputAmount),
    deadline: BigInt(intent.deadline),
    srcChain: BigInt(intent.srcChain),
    dstChain: BigInt(intent.dstChain),
  };
}
