import { useLeverageYieldEffectiveApr, useLeverageYieldTotalAssets } from '@sodax/dapp-kit';
import { formatRayPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FlashValue } from './motion';
import { formatUsd, toUsd } from './units';
import { useAssetUsdPrice, type VaultInfo } from './useVaults';

/**
 * A scrolling strip of every vault's live APR and TVL. Reads the same queries as the vault cards, so it adds no
 * requests. The second copy of the row exists only to make the loop seamless and is hidden from screen readers.
 */
export function TickerTape({ vaults }: { vaults: VaultInfo[] }) {
  return (
    <section aria-label="Live vault rates" className="ls-tape-mask overflow-hidden border-y py-2.5">
      <div className="ls-marquee flex w-max">
        {[0, 1].map(copy => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {vaults.map(info => (
              <TickerItem key={info.vault.name} info={info} />
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

function TickerItem({ info }: { info: VaultInfo }) {
  const vault = info.vault.vault;
  const { data: apr } = useLeverageYieldEffectiveApr({ params: { vault } });
  const { data: tvl } = useLeverageYieldTotalAssets({ params: { vault } });
  const price = useAssetUsdPrice(info.vault.asset);
  const rate = apr?.effectiveNetAprRay;
  const up = rate === undefined || rate >= 0n;

  return (
    <li className="flex items-center gap-2 px-6 font-mono text-sm whitespace-nowrap">
      <img src={info.logo} alt="" className="size-4 rounded-full" />
      <span className="font-semibold">{info.shareSymbol}</span>
      <FlashValue value={rate} className={cn('px-1', up ? 'text-success' : 'text-destructive')}>
        {up ? '▲' : '▼'} {formatRayPercent(rate)}
      </FlashValue>
      <span className="text-muted-foreground">
        TVL {tvl === undefined ? '–' : formatUsd(toUsd(tvl, info.assetDecimals, price))}
      </span>
      <span aria-hidden className="ml-4 text-border">
        |
      </span>
    </li>
  );
}
