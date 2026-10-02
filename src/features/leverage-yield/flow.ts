import { useLeverageYieldDetailedStatus, useLeverageYieldQuote } from '@sodax/dapp-kit';
import {
  type DetailedLeverageYieldStatus,
  isNoRouteRefusal,
  isSodaxError,
  type LeverageYieldQuoteParams,
  type SpokeChainKey,
} from '@sodax/sdk';
import type { ChainKey } from '@sodax/types';
import { useEffect, useMemo, useState } from 'react';
import { REFETCH_MS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';

export type VaultQuote = {
  quoted: bigint | undefined;
  minOutput: bigint | undefined;
  error: string | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
};

/**
 * Live leverage-yield quote (fee-aware) and the minimum we'd accept. Polls at REFETCH_MS, not the hook's 3s,
 * because a room shares one IP.
 */
export function useVaultQuote(payload: LeverageYieldQuoteParams | undefined, slippageBps: number): VaultQuote {
  const { data, isLoading, isFetching, refetch } = useLeverageYieldQuote({
    params: { payload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const quoted = data?.ok ? data.value.quoted_amount : undefined;
  return {
    quoted,
    minOutput: quoted !== undefined && quoted > 0n ? minAmountAfterSlippage(quoted, slippageBps) : undefined,
    error: data && !data.ok ? describeQuoteError(data.error) : undefined,
    isLoading: !!payload && isLoading,
    isFetching,
    refetch: () => void refetch(),
  };
}

function describeQuoteError(error: unknown): string {
  if (isSodaxError(error)) {
    return error.code === 'VALIDATION_FAILED' ? 'Check the amount and token.' : error.message;
  }
  const message = (error as { detail?: { message?: string } })?.detail?.message ?? 'The solver refused this quote.';
  if (/too low/i.test(message)) return 'Amount too low. Try at least ~$2.';
  if (isNoRouteRefusal(error))
    return 'No route right now. The amount may be too small or too large, or try again shortly.';
  return message;
}

/** Message for a failed build / approve / execute step. */
export function describeError(error: unknown): string {
  if (isSodaxError(error)) {
    if (error.code === 'INTENT_CREATION_FAILED') {
      return 'Simulation reverted: this transaction would fail. Check your balance and gas, then try again.';
    }
    if (error.code === 'RELAY_TIMEOUT') {
      return 'Delivery to Sonic is taking longer than usual. Your transaction is on-chain; check its link.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped';

export type Step = {
  id: string;
  label: string;
  detail?: string;
  state: StepState;
  chainKey?: ChainKey;
  hash?: string;
};

export function setStep(steps: Step[], id: string, patch: Partial<Step>): Step[] {
  return steps.map(s => (s.id === id ? { ...s, ...patch } : s));
}

export type Delivery = { srcChainKey: SpokeChainKey; srcTxHash: string; startedAt: number };

export type FillState =
  | { phase: 'idle' }
  | { phase: 'filling' }
  | { phase: 'filled'; fillTxHash?: string }
  | { phase: 'failed'; message: string }
  | { phase: 'timeout' };

/** Give up polling after this long and tell the user where to look. Intents expire after ~5 minutes. */
const FILL_TIMEOUT_MS = 10 * 60_000;

function readFill(data: DetailedLeverageYieldStatus): FillState {
  if (data.source === 'backend') {
    const d = data.data;
    if (d.status === 'solved') return { phase: 'filled', fillTxHash: d.result?.fillTxHash };
    if (d.status === 'failed') {
      return { phase: 'failed', message: d.userMessage ?? d.failureReason ?? 'The intent was not filled.' };
    }
    return { phase: 'filling' };
  }
  if (data.data.status === 3) return { phase: 'filled', fillTxHash: data.data.fill_tx_hash };
  if (data.data.status === 4) return { phase: 'failed', message: 'No solver filled the intent before it expired.' };
  return { phase: 'filling' };
}

/** Follows a submitted vault swap until a solver fills it, it fails, or we time out. */
export function useFillStatus(delivery: Delivery | undefined): FillState {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    if (!delivery) return;
    const id = setTimeout(() => setTimedOut(true), Math.max(0, delivery.startedAt + FILL_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(id);
  }, [delivery]);

  const { data } = useLeverageYieldDetailedStatus({
    params: { srcChainKey: delivery?.srcChainKey, srcTxHash: delivery?.srcTxHash },
    queryOptions: {
      refetchInterval: query => {
        const d = query.state.data;
        const phase = d?.ok ? readFill(d.value).phase : 'filling';
        return phase === 'filled' || phase === 'failed' || timedOut ? false : REFETCH_MS;
      },
    },
  });

  const read: FillState = !delivery ? { phase: 'idle' } : data?.ok ? readFill(data.value) : { phase: 'filling' };
  const phase = read.phase === 'filling' && timedOut ? 'timeout' : read.phase;
  const fillTxHash = read.phase === 'filled' ? read.fillTxHash : undefined;
  const message = read.phase === 'failed' ? read.message : undefined;

  // Stable identity: callers run effects on this, and a fresh object each render would loop.
  return useMemo((): FillState => {
    if (phase === 'filled') return { phase, fillTxHash };
    if (phase === 'failed') return { phase, message: message ?? '' };
    return { phase };
  }, [phase, fillTxHash, message]);
}
