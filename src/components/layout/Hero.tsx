import { brand } from '@/brand/brand.config';

/** Slim primary-surface app band: display title left, tagline right on wide screens. */
export function Hero() {
  return (
    <section className="bg-hero text-hero-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-6 sm:px-6 lg:flex-row lg:items-baseline lg:justify-between lg:gap-8">
        <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
          Leveraged staking yield, <span className="font-accent text-hero-accent">one</span> deposit.
        </h1>
        <p className="max-w-md text-sm font-light leading-relaxed text-hero-muted">{brand.tagline}</p>
      </div>
    </section>
  );
}
