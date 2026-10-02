import { brand } from '@/brand/brand.config';
import { InfoTip } from '@/components/ui/info-tip';
import { SOURCE_CHAINS } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';

/**
 * Page intro on the cream canvas: a "Universal deposits" tag, the headline with one word on a honey highlight, the
 * subline, and a strip of the networks this app accepts deposits from. The strip reads SOURCE_CHAINS, so it only ever
 * lists networks the app actually supports.
 */
export function Hero() {
  return (
    <section className="border-b text-hero-foreground">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-14 sm:px-6 sm:py-20">
        {brand.eyebrow && (
          <span className="w-fit rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
            {brand.eyebrow}
          </span>
        )}
        <h1 className="max-w-3xl font-display text-4xl font-semibold sm:text-5xl">
          Leveraged staking yield, from <span className="rounded-sm bg-hero-accent px-1.5">your</span> chain.
        </h1>
        <p className="flex max-w-2xl items-center gap-2 text-lg text-hero-muted">
          {brand.tagline}
          <InfoTip label="How a deposit works">{brand.howItWorks}</InfoTip>
        </p>
        <NetworkStrip />
      </div>
    </section>
  );
}

function NetworkStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="sr-only">Deposit from:</span>
      <ul className="flex flex-wrap items-center gap-2">
        {SOURCE_CHAINS.map(chainKey => {
          const logo = chainLogo(chainKey);
          return (
            <li
              key={chainKey}
              className="inline-flex items-center gap-1.5 rounded-sm border bg-card px-2 py-1 text-xs font-medium"
            >
              {logo && <img src={logo} alt="" className="size-4 rounded-full" />}
              {chainName(chainKey)}
            </li>
          );
        })}
      </ul>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        + more networks through SODAX
        <InfoTip label="About other networks">
          SODAX connects 20+ networks, EVM and non-EVM. This app starts with the EVM networks listed; builders can
          integrate once through the SDK to reach the rest.
        </InfoTip>
      </span>
    </div>
  );
}
