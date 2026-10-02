import { brand } from '@/brand/brand.config';

/** Primary-surface hero band. Display title in the display font, one accent word in the accent font. */
export function Hero() {
  return (
    <section className="bg-hero text-hero-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
          Staking yield, <span className="font-accent text-hero-accent">double-glazed</span>.
        </h1>
        <p className="max-w-2xl text-lg font-light text-hero-muted">{brand.tagline}</p>
      </div>
    </section>
  );
}
