import { useSodaxContext } from '@sodax/dapp-kit';
import { getTransactionPackets, type PacketData } from '@sodax/sdk';
import { getIntentRelayChainId, type SpokeChainKey } from '@sodax/types';
import { useQuery } from '@tanstack/react-query';
import { REFETCH_MS } from '@/config/workshop';

/** Stop asking the relay after this many reads (~10 min at REFETCH_MS). */
const MAX_POLLS = 60;

/**
 * The Sonic (hub) transaction that delivered an intent: the relay packet's `dst_tx_hash` for (source chain, source tx),
 * once the relay reports it executed. Polls every REFETCH_MS until found, then stays cached. For a Sonic source the
 * source tx is already on the hub, so there is nothing to look up.
 */
export function useHubTx(srcChainKey: SpokeChainKey, srcTxHash: string | undefined, known?: string) {
  const { sodax } = useSodaxContext();
  const query = useQuery({
    queryKey: ['relay', 'hubTx', srcChainKey, srcTxHash],
    enabled: !!srcTxHash && !known,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<string | null> => {
      if (!srcTxHash) return null;
      const result = await getTransactionPackets(
        {
          action: 'get_transaction_packets',
          params: { chain_id: String(getIntentRelayChainId(srcChainKey)), tx_hash: srcTxHash },
        },
        sodax.swaps.relayerApiEndpoint,
      );
      if (!result.ok) return null;
      const executed = result.value.data.filter(
        (packet: PacketData) => packet.status === 'executed' && !!packet.dst_tx_hash,
      );
      return executed.at(-1)?.dst_tx_hash ?? null;
    },
    refetchInterval: q =>
      q.state.data || q.state.dataUpdateCount + q.state.errorUpdateCount >= MAX_POLLS ? false : REFETCH_MS,
  });
  return known ?? query.data ?? undefined;
}
