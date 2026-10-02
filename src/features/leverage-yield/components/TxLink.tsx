import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import type { ChainKey } from '@sodax/types';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { shortenAddress } from '@/lib/format';

export function TxLink({ chainKey, hash }: { chainKey: ChainKey; hash: string }) {
  const url = explorerTxUrl(chainKey, hash);
  const text = `${shortenAddress(hash, 6)} on ${chainName(chainKey)}`;
  if (!url) return <span className="font-mono">{text}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-foreground underline decoration-link decoration-2 underline-offset-4 hover:decoration-primary"
    >
      {text}
      <ArrowSquareOutIcon weight="duotone" className="size-3" />
    </a>
  );
}
