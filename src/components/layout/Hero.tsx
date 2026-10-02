import { brand } from '@/brand/brand.config';

const TICKER = [
  'lsodaWEETH',
  'lsodaWSTETH',
  'lsodaJITOSOL',
  'lsodaSUSDS',
  'deposit from base · arbitrum · sonic',
  'leveraged staking yield',
  'mainnet only · real funds',
];

/** Terminal-style hero: pixel headline with a blinking cursor, then a scrolling ticker tape. */
export function Hero() {
  return (
    <section className="border-b-4 border-window-frame bg-hero text-hero-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
        <p className="font-sans text-sm text-hero-muted">C:\SODAX\VAULTS&gt; run yield.exe</p>
        <h1 className="max-w-3xl font-display text-xl leading-relaxed sm:text-3xl sm:leading-relaxed">
          Leveraged staking yield, <span className="font-accent text-hero-accent">one</span> deposit
          <span className="blink" aria-hidden="true">
            _
          </span>
        </h1>
        <p className="max-w-2xl text-base text-hero-muted">{brand.tagline}</p>
      </div>
      <div className="overflow-hidden border-t-2 border-dashed border-border bg-secondary py-2" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map(copy => (
            <div key={copy} className="flex shrink-0">
              {TICKER.map(item => (
                <span key={item} className="px-6 font-display text-[10px] uppercase text-secondary-foreground">
                  <span className="text-hero-accent">★</span> {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
