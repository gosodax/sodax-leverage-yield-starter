import { type ChainKey, tokenLogo } from '@sodax/types';
import { useState } from 'react';
import { chainLogo } from '@/lib/chains';
import { cn } from '@/lib/utils';

/** Token logo from the SODAX asset CDN (letter disc fallback), with an optional network badge. */
export function TokenIcon({
  symbol,
  chainKey,
  className,
}: {
  symbol: string;
  chainKey?: ChainKey;
  className?: string;
}) {
  const src = tokenLogo(symbol);
  const [failed, setFailed] = useState<string>();
  const badge = chainKey && chainLogo(chainKey);
  return (
    <span className={cn('relative inline-flex size-8 shrink-0', className)}>
      {failed === src ? (
        <span className="flex size-full items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {symbol.slice(0, 1)}
        </span>
      ) : (
        <img src={src} alt="" className="size-full rounded-full" onError={() => setFailed(src)} />
      )}
      {badge && (
        <img
          src={badge}
          alt=""
          className="absolute -right-0.5 -bottom-0.5 size-[45%] rounded-full bg-card ring-2 ring-card"
        />
      )}
    </span>
  );
}

export function ChainIcon({ chainKey, className }: { chainKey: ChainKey; className?: string }) {
  const src = chainLogo(chainKey);
  return src ? (
    <img src={src} alt="" className={cn('size-5 rounded-full', className)} />
  ) : (
    <span className={cn('size-5 rounded-full bg-muted', className)} />
  );
}
