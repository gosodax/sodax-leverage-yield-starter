import { HeroBackdrop } from './HeroBackdrop';
import { SoplicaCard } from './SoplicaCard';

/**
 * Primary-surface hero band, laid out like the Polish flag: a dark field with a waving white-over-red band. Display title in the
 * display font, one accent word in the accent font.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden text-hero-foreground">
      <div className="relative bg-hero-dark">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 pb-32 pt-10 sm:px-6 sm:pt-12">
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-hero-muted">🇵🇱 Built in Poland</span>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              <span className="block">Best liquid</span>
              <span className="block">
                is <span className="font-accent text-hero-accent">Polish</span> liquid.
              </span>
              <span className="mt-3 block text-2xl text-hero-muted sm:text-3xl">
                Best <span className="font-accent text-hero-accent">yield</span>, too.
              </span>
            </h1>
            <p className="max-w-md text-pretty text-sm text-hero-muted">
              Deposit from any network and earn leveraged staking yield in one vault.
            </p>
          </div>
          <SoplicaCard />
        </div>
      </div>
    </section>
  );
}
